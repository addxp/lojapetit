import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Truck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operação",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/vendas", label: "Vendas", icon: ShoppingCart },
      { href: "/produtos", label: "Produtos", icon: Shirt },
      { href: "/estoque", label: "Estoque", icon: Boxes },
    ],
  },
  {
    title: "Gestão",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: Wallet },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/fornecedores", label: "Fornecedores", icon: Truck },
      { href: "/equipe", label: "Equipe", icon: ShieldCheck },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Atalhos para as telas das ações mais frequentes. */
export const QUICK_ACTIONS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/vendas", label: "Nova venda", hint: "Abrir o caixa", icon: ShoppingCart },
  { href: "/produtos", label: "Novo produto", hint: "Cadastrar peça", icon: Shirt },
  { href: "/estoque", label: "Ajustar estoque", hint: "Entradas e saídas", icon: Boxes },
  { href: "/financeiro", label: "Lançar despesa", hint: "Controle financeiro", icon: Receipt },
  { href: "/clientes", label: "Novo cliente", hint: "Cadastro rápido", icon: UserPlus },
];

export const STORE = process.env.NEXT_PUBLIC_STORE_NAME || "Minha Loja";

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
