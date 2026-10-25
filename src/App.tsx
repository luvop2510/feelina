import { allowNavigation } from "./lib/useUnsavedChanges";
import { useEffect, useState, useRef } from "react";
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
  CircleHelp,
  ChevronRight,
  Plus,
  Bell,
} from "lucide-react";
import { supabase, loadWorkspace } from "./lib/api";
import {
  emptyWorkspace,
  money,
  date,
  today,
  type Workspace,
} from "./lib/types";
import { sampleWorkspace } from "./lib/sample";
import { AppContext, useApp } from "./lib/context";
import { Auth, ResetPassword } from "./components/Auth";
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
  { id: "dashboard", label: "Overview", icon: LayoutDashboard, roles: [] },
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
  const [sample, setSample] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [route, setRoute] = useState(location.hash.slice(1) || "dashboard");
  const [menu, setMenu] = useState(false);
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
    setTimeout(
      () => document.querySelector<HTMLElement>("main h1")?.focus(),
      50,
    );
  };
  async function reload() {
    setError("");
    try {
      const result = await loadWorkspace();
      setData(result);
      setSignedIn(!!result.profile);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    void reload();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSignedIn(!!session);
      if (event === "PASSWORD_RECOVERY") navigate("reset-password");
      if (event === "SIGNED_OUT") {
        setData(emptyWorkspace);
        setLoading(false);
      } else setTimeout(() => void reload(), 0);
    });
    return () => subscription.unsubscribe();
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
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const current = sample ? sampleWorkspace : data;
  const can = (roles: string[]) =>
    !roles.length || roles.includes(current.profile?.role || "");
  async function signOut() {
    if (!allowNavigation()) return;
    if (sample) {
      setSample(false);
      navigate("dashboard");
      return;
    }
    await supabase?.auth.signOut();
    navigate("dashboard");
  }
  if (loading)
    return (
      <div className="center-page">
        <Busy />
      </div>
    );
  if (!sample && signedIn && data.profile?.must_change_password)
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
  if (!sample && !signedIn)
    return (
      <>
        <ErrorMessage error={error} />
        <Auth
          onSample={() => {
            setSample(true);
            navigate("dashboard");
          }}
        />
      </>
    );
  if (!sample && (!data.profile || data.profile.status !== "active"))
    return (
      <div className="center-page">
        <div className="pending-card">
          <div className="wordmark">feelina</div>
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
      value={{ data: current, sample, reload, notify: setToast, navigate, can }}
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
          if (
            a &&
            a.getAttribute("href") !== "#main-content" &&
            !allowNavigation()
          ) {
            e.preventDefault();
            e.stopPropagation();
          } else if (a) {
            approvedRoute.current = true;
          }
        }}
      >
        <aside className={"sidebar " + (menu ? "is-open" : "")}>
          <div className="sidebar-brand">
            <a href="#dashboard" className="wordmark">
              feelina<span>PARTNER WORKSPACE</span>
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
            <span className="workspace-emblem">F</span>
            <div>
              <strong>Feelina workspace</strong>
              <small>
                {sample ? "Sample organisation" : "Business operations"}
              </small>
            </div>
          </div>
          <div className="nav-caption">WORKSPACE</div>
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
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <CircleHelp size={18} />
              <p>
                Made for a smoother
                <br />
                <strong>business day.</strong>
              </p>
            </div>
            <button
              className="profile-button"
              onClick={() => void signOut()}
              title={sample ? "Exit sample workspace" : "Sign out"}
            >
              <span className="avatar">
                {current.profile?.full_name?.slice(0, 1) || "F"}
              </span>
              <span>
                <strong>
                  {sample
                    ? "Sample workspace"
                    : current.profile?.full_name || "Your account"}
                </strong>
                <small>{sample ? "Exit sample" : current.profile?.role}</small>
              </span>
              <LogOut size={16} />
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
                onClick={() => setMenu(true)}
              >
                <Menu size={21} />
              </button>
              <span className="topbar-label">Workspace</span>
              <ChevronRight size={14} />
              <strong>{currentNav?.label || "Orders"}</strong>
            </div>
            <div className="topbar-right">
              <span className="date-label">{date(today())}</span>
              <button
                className="icon-button"
                onClick={() =>
                  sample
                    ? setToast(
                        "You are viewing a read-only sample. Sign in to use live business data.",
                      )
                    : void reload()
                }
                aria-label="Refresh workspace"
              >
                <RefreshCw size={17} />
              </button>
              <span className="topbar-avatar">F</span>
            </div>
          </header>
          {sample && (
            <div className="sample-banner">
              <span>
                <strong>Sample workspace</strong> · Fictional data, read-only.
                Explore the layout and workflows.
              </span>
              <button onClick={() => void signOut()}>
                Go to sign in <ArrowUpRight size={14} />
              </button>
            </div>
          )}
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
            <span>Feelina · thoughtfully connected</span>
            <span>{sample ? "SAMPLE DATA" : "SECURE PARTNER WORKSPACE"}</span>
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
  const { data, navigate, can, sample } = useApp();
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
  const rows = [...data.orders]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 5);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR BUSINESS AT A GLANCE</div>
          <h1 tabIndex={-1}>A little clarity for your day.</h1>
          <p>Keep every order, every size, and every next step in view.</p>
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
          value={String(pending.length).padStart(2, "0")}
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
          value={String(low.length).padStart(2, "0")}
          detail="Fewer than 10 available units"
          icon={<Boxes size={18} />}
          warning={low.length > 0}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel orders-panel">
          <div className="panel-header">
            <div>
              <h2>Recent orders</h2>
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
                    <th>Amount</th>
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
        <section className="panel attention-panel">
          <div className="panel-header">
            <div>
              <h2>Needs attention</h2>
              <p>A few things to keep moving.</p>
            </div>
            <Bell size={18} className="muted" />
          </div>
          <button className="attention-item" onClick={() => navigate("orders")}>
            <span className="attention-icon plum">
              <ClipboardList size={19} />
            </span>
            <span>
              <strong>
                {data.orders.filter((o) => o.status === "submitted").length}{" "}
                orders awaiting confirmation
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
              <span className="attention-icon amber">
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
              <span className="attention-icon sage">
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
            A clear next step. A calmer workday.
          </div>
        </section>
      </div>
      <section className="collection-banner">
        <div className="collection-copy">
          <div className="eyebrow">THE FEELINA COLLECTION</div>
          <h2>
            Every size. Every shade.
            <br />
            <em>Everyday confidence.</em>
          </h2>
          <p>A considered collection, ready for your next order.</p>
          <button className="text-button" onClick={() => navigate("catalogue")}>
            Explore catalogue <ArrowRightIcon />
          </button>
        </div>
        <div className="swatches" aria-hidden="true">
          <div className="swatch rose">
            <span>ROSE</span>
          </div>
          <div className="swatch ivory">
            <span>IVORY</span>
          </div>
          <div className="swatch charcoal">
            <span>CHARCOAL</span>
          </div>
        </div>
        <span className="collection-caption">
          {sample ? "ILLUSTRATIVE COLLECTION" : "FEELINA ESSENTIALS"}
        </span>
      </section>
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={16} />;
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
        <span>{label}</span>
        <span className={warning ? "stat-icon warning" : "stat-icon"}>
          {icon}
        </span>
      </div>
      <strong className="stat-value">{value}</strong>
      <p>{detail}</p>
    </section>
  );
}
