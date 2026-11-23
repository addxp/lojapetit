import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  const isNoAccess = path.startsWith("/sem-acesso");

  const go = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    const redirect = NextResponse.redirect(url);
    // mantém os cookies de sessão renovados também nos redirecionamentos
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user) {
    return isLogin ? response : go("/login");
  }

  // Conta criada, mas só tem acesso quem virou dona (usou um código de convite).
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  // falha momentânea de rede/banco não deve expulsar ninguém (o RLS segue protegendo os dados)
  if (profileError) return response;
  const hasAccess = !!profile;

  if (!hasAccess) return isNoAccess ? response : go("/sem-acesso");
  if (isLogin || isNoAccess) return go("/");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
