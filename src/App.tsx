import { allowNavigation } from "./lib/useUnsavedChanges";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Users,
  Boxes,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
  Plus,
  Bell,
  ChevronUp,
} from "lucide-react";
import { supabase, loadWorkspace } from "./lib/api";
import {
  emptyWorkspace,
  money,
  date,
  today,
  type Workspace,
} from "./lib/types";
import { AppContext, useApp } from "./lib/context";
import { Auth, ResetPassword } from "./components/Auth";
import "./components/AccountMenu.css";
import { Brand } from "./components/Brand";
import { Badge, Busy, Empty, ErrorMessage } from "./components/ui";
import { Orders, OrderEditor, OrderDetail } from "./components/Orders";
import {
  Catalogue,
  Customers,
  Inventory,
  Payments,
  Reports,
  SettingsPage,
} from "./components/Modules";
const nav = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [] },
  {
    id: "orders",
    label: "Orders",
    icon: ClipboardList,
    roles: [
      "owner",
      "admin",
      "sales",
      "fulfilment",
      "accounts",
      "retailer",
      "inventory",
    ],
  },
  {
    id: "catalogue",
    label: "Catalogue",
    icon: Package,
    roles: ["owner", "admin", "sales", "inventory", "retailer"],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    roles: ["owner", "admin", "sales", "accounts"],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    roles: ["owner", "admin", "inventory", "fulfilment"],
  },
  {
    id: "payments",
    label: "Payments",
    icon: Wallet,
    roles: ["owner", "admin", "accounts", "retailer"],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["owner", "admin", "accounts", "sales", "inventory"],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    roles: ["owner", "admin"],
  },
];
export default function App() {
  const [data, setData] = useState<Workspace>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [route, setRoute] = useState(location.hash.slice(1) || "dashboard");
  const [menu, setMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountTrigger = useRef<HTMLButtonElement>(null);
  const loadGeneration = useRef(0);
  const activeUserId = useRef<string | null>(null);
  const profileLoaded = useRef(false);
  const menuRef = useRef<HTMLElement>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const approvedRoute = useRef(false);
  const currentRoute = useRef(route);
  const navigate = (r: string) => {
    if (!allowNavigation()) return;
    approvedRoute.current = true;
    currentRoute.current = r;
    location.hash = r;
    setRoute(r);
    setMenu(false);
    setAccountOpen(false);
    setTimeout(
      () => document.querySelector<HTMLElement>("main h1")?.focus(),
      50,
    );
  };
  async function reload() {
    const generation = ++loadGeneration.current;
    if (!profileLoaded.current) setLoading(true);
    setError("");
    try {
      const result = await loadWorkspace();
      if (generation === loadGeneration.current) {
        profileLoaded.current = !!result.profile;
        setData(result);
      }
    } catch (e) {
      if (generation === loadGeneration.current) setError((e as Error).message);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const generation = ++loadGeneration.current;
      const nextUserId = session?.user.id || null;
      if (activeUserId.current !== nextUserId) {
        activeUserId.current = nextUserId;
        profileLoaded.current = false;
        setData(emptyWorkspace);
      }
      setSignedIn(!!session);
      setError("");
      if (!session) {
        setData(emptyWorkspace);
        setLoading(false);
        setAccountOpen(false);
        return;
      }
      // Auth resolves before the profile request. Keep the access gate pending
      // until that request completes, and discard loads from an older session.
      if (!profileLoaded.current) setLoading(true);
      if (event === "PASSWORD_RECOVERY") navigate("reset-password");
      setTimeout(() => {
        if (generation === loadGeneration.current) void reload();
      }, 0);
    });
    return () => {
      loadGeneration.current++;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    const change = () => {
      const next = location.hash.slice(1) || "dashboard";
      if (!approvedRoute.current && !allowNavigation()) {
        approvedRoute.current = true;
        location.hash = currentRoute.current;
        return;
      }
      approvedRoute.current = false;
      currentRoute.current = next;
      setRoute(next);
      setMenu(false);
      setTimeout(
        () => document.querySelector<HTMLElement>("main h1")?.focus(),
        50,
      );
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const sidebar = menuRef.current;
    sidebar?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !accountRef.current?.querySelector("#account-actions")
      ) {
        setMenu(false);
        menuTrigger.current?.focus();
      }
      if (event.key === "Tab" && sidebar) {
        const controls = [
          ...sidebar.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled])",
          ),
        ];
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!accountOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node))
        setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAccountOpen(false);
        accountTrigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [accountOpen]);
  const current = data;
  const can = (roles: string[]) =>
    !roles.length || roles.includes(current.profile?.role || "");
  async function signOut() {
    if (signingOut || !allowNavigation()) return;
    setSigningOut(true);
    try {
      const result = await supabase?.auth.signOut();
      if (result?.error) throw result.error;
      setAccountOpen(false);
      navigate("dashboard");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSigningOut(false);
    }
  }
  if (loading)
    return (
      <div className="center-page">
        <Busy />
      </div>
    );
  if (signedIn && data.profile?.must_change_password)
    return <ResetPassword required done={() => void reload()} />;
  if (route === "reset-password" && signedIn)
    return (
      <ResetPassword
        done={() => {
          setToast("Password updated.");
          navigate("dashboard");
        }}
      />
    );
  if (!signedIn)
    return (
      <>
        <ErrorMessage error={error} />
        <Auth />
      </>
    );
  if (!data.profile)
    return (
      <div className="center-page">
        <div className="pending-card">
          <h1>We couldn’t load your workspace</h1>
          <p>Your account is signed in. Try loading the workspace again.</p>
          <ErrorMessage error={error} />
          <div className="account-retry-actions">
            <button className="button primary" onClick={() => void reload()}>
              Try again
            </button>
            <button
              className="button secondary"
              disabled={signingOut}
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  if (data.profile.status !== "active")
    return (
      <div className="center-page">
        <div className="pending-card">
          <div className="wordmark">
            <Brand />
          </div>
          <ShieldCheck size={38} />
          <h1>
            {data.profile?.status === "pending"
              ? "Your application is with us"
              : "Account access is unavailable"}
          </h1>
          <p>
            {data.profile?.status === "pending"
              ? "Thanks for registering. The Feelina team needs to approve your account and connect your retailer profile before you can view wholesale prices or place orders."
              : "Please contact the Feelina administrator to review your account access."}
          </p>
          <ErrorMessage error={error} />
          <button className="button primary" onClick={() => void reload()}>
            Check approval status
          </button>
          <button className="button secondary" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  const section = route.split("/")[0];
  const currentNav = nav.find((n) => n.id === section);
  const allowed = !currentNav || can(currentNav.roles);
  return (
    <AppContext.Provider
      value={{
        data: current,
        sample: false,
        reload,
        notify: setToast,
        navigate,
        can,
      }}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <div
        className="app-shell"
        onClickCapture={(e) => {
          const a = (e.target as Element).closest('a[href^="#"]');
          if (a && a.getAttribute("href") !== "#main-content") {
            e.preventDefault();
            navigate(a.getAttribute("href")!.slice(1));
          }
        }}
      >
        <aside
          id="workspace-navigation"
          ref={menuRef}
          className={"sidebar " + (menu ? "is-open" : "")}
        >
          <div className="sidebar-brand">
            <a href="#dashboard" className="wordmark">
              <Brand />
            </a>
            <button
              className="icon-button mobile-only"
              onClick={() => setMenu(false)}
              aria-label="Close menu"
            >
              <X />
            </button>
          </div>
          <div className="workspace-label">
            <span className="workspace-emblem">
              <Brand className="workspace-brand" />
            </span>
            <div>
              <strong>Feelina workspace</strong>
              <small>Business operations</small>
            </div>
          </div>
          <div className="nav-caption">Workspace</div>
          <nav aria-label="Main navigation">
            {nav
              .filter((n) => can(n.roles))
              .map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  className={section === id ? "nav-item active" : "nav-item"}
                  href={"#" + id}
                  aria-current={section === id ? "page" : undefined}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                  {id === "orders" &&
                    current.orders.filter((o) => o.status === "submitted")
                      .length > 0 && (
                      <span className="nav-count">
                        {
                          current.orders.filter((o) => o.status === "submitted")
                            .length
                        }
                      </span>
                    )}
                </a>
              ))}
          </nav>
          <div className="sidebar-bottom" ref={accountRef}>
            {accountOpen && (
              <div
                className="account-panel"
                id="account-actions"
                aria-label="Your account"
              >
                <strong>{current.profile?.full_name || "Your account"}</strong>
                <span>{current.profile?.email}</span>
                <span className="account-role">{current.profile?.role}</span>
                <button
                  className="button secondary full"
                  disabled={signingOut}
                  onClick={() => void signOut()}
                >
                  <LogOut size={17} aria-hidden="true" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
            <button
              className="profile-button"
              ref={accountTrigger}
              onClick={() => setAccountOpen((open) => !open)}
              aria-expanded={accountOpen}
              aria-controls="account-actions"
              title="Your account"
            >
              <span className="avatar">
                {current.profile?.full_name?.slice(0, 1) || "F"}
              </span>
              <span>
                <strong>{current.profile?.full_name || "Your account"}</strong>
                <small>{current.profile?.role}</small>
              </span>
              <ChevronUp size={16} aria-hidden="true" />
            </button>
          </div>
        </aside>
        {menu && (
          <button
            aria-label="Close navigation"
            className="menu-scrim"
            onClick={() => setMenu(false)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div>
              <button
                className="icon-button mobile-only"
                aria-label="Open navigation"
                ref={menuTrigger}
                aria-expanded={menu}
                aria-controls="workspace-navigation"
                onClick={() => setMenu(true)}
              >
                <Menu size={21} />
              </button>
              <span className="mobile-only topbar-brand">
                <Brand />
              </span>
              <span className="topbar-label">Workspace</span>
              <ChevronRight size={14} />
              <strong>{currentNav?.label || "Orders"}</strong>
            </div>
            <div className="topbar-right">
              <span className="date-label">{date(today())}</span>
              <button
                className="icon-button"
                onClick={() => void reload()}
                aria-label="Refresh workspace"
              >
                <RefreshCw size={17} />
              </button>
              <span className="topbar-avatar">F</span>
            </div>
          </header>
          <main id="main-content" className="page-content" tabIndex={-1}>
            <ErrorMessage error={error} />
            {!allowed ? (
              <Empty title="This section isn’t in your role">
                Your administrator can help with access.
              </Empty>
            ) : section === "dashboard" ? (
              <Dashboard />
            ) : section === "orders" && route === "orders/new" ? (
              <OrderEditor key={route} />
            ) : section === "orders" && route.endsWith("/edit") ? (
              <OrderEditor key={route} orderId={route.split("/")[1]} />
            ) : section === "orders" && route.split("/").length > 1 ? (
              <OrderDetail id={route.split("/")[1]} />
            ) : section === "orders" ? (
              <Orders />
            ) : section === "catalogue" ? (
              <Catalogue />
            ) : section === "customers" ? (
              <Customers />
            ) : section === "inventory" ? (
              <Inventory />
            ) : section === "payments" ? (
              <Payments />
            ) : section === "reports" ? (
              <Reports />
            ) : section === "settings" ? (
              <SettingsPage />
            ) : (
              <Dashboard />
            )}
          </main>
          <footer className="workspace-footer">
            <span>Feelina partner workspace</span>
            <span>Secure workspace</span>
          </footer>
        </div>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button
            className="icon-button"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
function Dashboard() {
  const { data, navigate, can } = useApp();
  const active = data.orders.filter(
    (o) => o.status !== "cancelled" && o.status !== "draft",
  );
  const total = active.reduce((s, o) => s + Number(o.total_paise), 0);
  const outstanding = active.reduce(
    (s, o) =>
      s +
      Math.max(
        0,
        Number(o.total_paise) -
          Number(o.paid_paise) -
          Number(o.credit_paise || 0),
      ),
    0,
  );
  const pending = data.orders.filter((o) =>
    ["submitted", "confirmed", "processing", "packed"].includes(o.status),
  );
  const low = data.variants.filter((v) => v.stock - v.reserved < 10);
  const pipeline = [
    ["submitted", "Submitted"],
    ["confirmed", "Confirmed"],
    ["processing", "Processing"],
    ["packed", "Packed"],
    ["dispatched", "Dispatched"],
    ["delivered", "Delivered"],
  ].map(([status, label]) => ({
    status,
    label,
    count: data.orders.filter((o) => o.status === status).length,
  }));
  const maxCount = Math.max(1, ...pipeline.map((item) => item.count));
  const rows = [...data.orders]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 5);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1 tabIndex={-1}>Dashboard</h1>
          <p>Manage your orders, inventory and retail partners.</p>
        </div>
        {can(["owner", "admin", "sales", "retailer"]) && (
          <button
            className="button primary"
            onClick={() => navigate("orders/new")}
          >
            <Plus size={17} />
            Create order
          </button>
        )}
      </div>
      <div className="stats-grid">
        <Stat
          label="Order value"
          value={money(total)}
          detail={`${active.length} active orders`}
          icon={<Wallet size={18} />}
        />
        <Stat
          label="Orders to fulfil"
          value={String(pending.length)}
          detail="From submission to dispatch"
          icon={<ClipboardList size={18} />}
        />
        <Stat
          label="Outstanding payments"
          value={money(outstanding)}
          detail="Across active customer orders"
          icon={<BarChart3 size={18} />}
        />
        <Stat
          label="Low-stock variants"
          value={String(low.length)}
          detail="Fewer than 10 available units"
          icon={<Boxes size={18} />}
          warning={low.length > 0}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel fulfilment-panel">
          <div className="panel-header">
            <div>
              <h2>
                <BarChart3 size={18} aria-hidden="true" /> Order pipeline
              </h2>
              <p>Orders at each stage of fulfilment</p>
            </div>
            <button
              className="icon-button"
              aria-label="View all orders"
              onClick={() => navigate("orders")}
            >
              <ArrowUpRight size={17} />
            </button>
          </div>
          <div
            className="pipeline-chart"
            role="img"
            aria-label={pipeline
              .map((item) => `${item.label}: ${item.count}`)
              .join(", ")}
          >
            {pipeline.map((item) => (
              <div className="pipeline-column" key={item.status}>
                <strong>{item.count}</strong>
                <div className="pipeline-track">
                  <div
                    className="pipeline-bar"
                    style={
                      {
                        "--bar-size": `${(item.count / maxCount) * 100}%`,
                      } as CSSProperties
                    }
                  />
                </div>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel attention-panel">
          <div className="panel-header">
            <div>
              <h2>
                <Bell size={18} aria-hidden="true" /> Needs attention
              </h2>
              <p>A few things to keep moving.</p>
            </div>
          </div>
          <button className="attention-item" onClick={() => navigate("orders")}>
            <span className="attention-icon">
              <ClipboardList size={19} />
            </span>
            <span>
              <strong>
                {data.orders.filter((o) => o.status === "submitted").length}{" "}
                {data.orders.filter((o) => o.status === "submitted").length ===
                1
                  ? "order awaiting confirmation"
                  : "orders awaiting confirmation"}
              </strong>
              <small>Review quantities and reserve stock</small>
            </span>
            <ChevronRight size={15} />
          </button>
          {can(["owner", "admin", "inventory", "fulfilment"]) && (
            <button
              className="attention-item"
              onClick={() => navigate("inventory")}
            >
              <span className="attention-icon">
                <Boxes size={19} />
              </span>
              <span>
                <strong>{low.length} variants running low</strong>
                <small>Check stock before your next order</small>
              </span>
              <ChevronRight size={15} />
            </button>
          )}
          {can(["owner", "admin"]) && (
            <button
              className="attention-item"
              onClick={() => navigate("settings")}
            >
              <span className="attention-icon">
                <ShieldCheck size={19} />
              </span>
              <span>
                <strong>
                  {data.settings?.company_verified
                    ? "Business details verified"
                    : "Complete business setup"}
                </strong>
                <small>
                  {data.settings?.company_verified
                    ? "Keep your details up to date"
                    : "Verify details before issuing invoices"}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
          )}
          <div className="attention-foot">
            Review pending orders before dispatch.
          </div>
        </section>
      </div>
      <section className="panel orders-panel">
        <div className="panel-header">
          <div>
            <h2>
              <ClipboardList size={18} aria-hidden="true" /> Recent orders
            </h2>
            <p>The latest from your retail partners.</p>
          </div>
          <button className="text-button" onClick={() => navigate("orders")}>
            View all <ArrowUpRight size={15} />
          </button>
        </div>
        {rows.length ? (
          <div className="table-wrap" tabIndex={0} aria-label="Recent orders">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="numeric">Amount</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => navigate("orders/" + o.id)}
                      >
                        {o.number}
                      </button>
                      <small>{date(o.order_date)}</small>
                    </td>
                    <td>
                      <strong>
                        {o.customer_snapshot?.shop_name ||
                          data.customers.find((c) => c.id === o.customer_id)
                            ?.shop_name ||
                          "Customer"}
                      </strong>
                      <small>{o.order_type}</small>
                    </td>
                    <td className="numeric">{money(o.total_paise)}</td>
                    <td>
                      <Badge status={o.status} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => navigate("orders/" + o.id)}
                        aria-label={"View order " + o.number}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your first order starts here">
            Add products and a customer, then enter quantities in the size
            matrix.
          </Empty>
        )}
      </section>
    </>
  );
}
function Stat({
  label,
  value,
  detail,
  icon,
  warning = false,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <section className="stat-card">
      <div className="stat-label">
        <span>
          {icon}
          {label}
        </span>
        <span className={warning ? "stat-icon warning" : "stat-icon"}>
          <ArrowUpRight size={13} />
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
