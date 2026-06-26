import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  CircleDot,
  Coins,
  Gauge,
  LineChart,
  MessageCircle,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useUserContext } from "@/context/UserContext";
import { useHomeStats } from "@/hooks/useHomeStats";

/* ---------- Número animado (count-up suave) ---------- */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    const duration = 600;
    let start: number | null = null;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else fromRef.current = to;
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = display;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}

/* ---------- Card de estatística ---------- */
function StatCard({
  icon,
  label,
  value,
  suffix,
  decimals,
  accent,
  soon,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  accent: string;
  soon?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-gradient-to-b from-white/[0.04] to-transparent p-5 transition-all duration-300 hover:border-green-500/40 hover:from-white/[0.07]">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-40 ${accent}`} />
      <div className="relative flex items-center gap-2 text-gray-400">
        <span className="text-green-400">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="relative mt-3 text-3xl font-bold text-white sm:text-4xl">
        {soon ? (
          <span className="inline-block rounded-lg bg-blue-400/15 px-3 py-1 text-base font-semibold text-blue-300">
            Em breve
          </span>
        ) : (
          <>
            <AnimatedNumber value={value} decimals={decimals} />
            {suffix && <span className="ml-1 text-xl text-gray-400">{suffix}</span>}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Card de recurso ---------- */
function FeatureCard({
  icon,
  title,
  badge,
  badgeColor,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-brand-border bg-white/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-green-500/40 hover:bg-white/[0.04]">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-400 ring-1 ring-green-500/20">
        {icon}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeColor}`}>{badge}</span>
      </div>
      <p className="text-sm leading-relaxed text-gray-400">{children}</p>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated } = useUserContext();
  const stats = useHomeStats();

  return (
    <div className="w-full px-3 py-6 text-white sm:px-6">
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden rounded-3xl border border-brand-border bg-brand-sidebar/40">
        {/* glows de fundo */}
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-green-500/20 blur-[100px]" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-72 w-72 rounded-full bg-teal-400/10 blur-[100px]" />

        <div className="relative px-6 py-14 text-center sm:px-10 sm:py-20">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 text-xs font-medium text-green-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Monitoramento em tempo real · 100% nacional
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl">
            <span className="text-white">ARB</span>
            <span className="bg-gradient-to-r from-green-400 to-teal-300 bg-clip-text text-transparent">PRIME</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base text-gray-300 sm:text-lg">
            A plataforma brasileira de arbitragem que encontra{" "}
            <strong className="text-white">surebets</strong> em casas de apostas e{" "}
            <strong className="text-white">oportunidades cripto</strong> em mercados perpétuos —
            tudo processado pelos nossos próprios servidores, sem APIs de terceiros.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/arbbets"
              className="group inline-flex items-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-brand-dark transition-all hover:bg-green-400 hover:shadow-[0_0_25px_-5px] hover:shadow-green-500/50"
            >
              <Target size={18} />
              Ver surebets agora
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <span className="inline-flex items-center gap-2 rounded-xl border border-brand-border bg-white/[0.02] px-6 py-3 text-sm font-semibold text-gray-400">
              <Coins size={18} className="text-teal-300/70" />
              Arbitragem cripto
              <span className="rounded-full bg-blue-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                Em breve
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ===================== STATS AO VIVO ===================== */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
            <Activity size={16} className="text-green-400" />
            Mercado agora
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <CircleDot size={12} className={stats.live ? "text-green-400" : "text-gray-600"} />
            {stats.live ? "Ao vivo" : "Carregando…"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<TrendingUp size={16} />}
            label="Surebets > 1%"
            value={stats.surebetsAbove1}
            accent="bg-green-500"
          />
          <StatCard
            icon={<Target size={16} />}
            label="Surebets ativas"
            value={stats.totalSurebets}
            accent="bg-teal-400"
          />
          <StatCard
            icon={<Gauge size={16} />}
            label="Melhor lucro"
            value={stats.bestProfit}
            suffix="%"
            decimals={2}
            accent="bg-emerald-400"
          />
          <StatCard
            icon={<Coins size={16} />}
            label="Oportunidades cripto"
            value={stats.cryptoOps}
            accent="bg-cyan-400"
            soon
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon={<Building2 size={16} />}
            label="Casas monitoradas"
            value={stats.bookmakers}
            accent="bg-green-500"
          />
          <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-brand-border bg-white/[0.02] p-5 lg:col-span-3">
            <ShieldCheck size={28} className="shrink-0 text-green-400" />
            <p className="text-sm text-gray-400">
              {isAuthenticated
                ? "Dados atualizados em tempo real direto dos nossos coletores. As surebets são recalculadas continuamente conforme as odds mudam."
                : "Crie sua conta gratuitamente para acompanhar todas as surebets ao vivo, com filtros, alertas e calculadora integrada."}
            </p>
            {!isAuthenticated && (
              <Link
                href="/auth"
                className="ml-auto shrink-0 rounded-lg bg-green-500/15 px-4 py-2 text-sm font-semibold text-green-300 ring-1 ring-green-500/30 transition hover:bg-green-500/25"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ===================== O QUE ESTAMOS CONSTRUINDO ===================== */}
      <section className="mt-12">
        <h2 className="mb-1 text-2xl font-bold text-white">O que estamos construindo</h2>
        <p className="mb-6 text-sm text-gray-400">Um ecossistema completo de arbitragem, do dado bruto à entrada assistida.</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Target size={22} />}
            title="ArbBets"
            badge="Ao vivo"
            badgeColor="bg-green-500/15 text-green-300"
          >
            Surebets <strong className="text-gray-200">prematch</strong> de casas brasileiras, com filtros
            por lucro, esporte e bookmaker. Em breve, apostas ao vivo (live).
          </FeatureCard>
          <FeatureCard
            icon={<Coins size={22} />}
            title="ArbCrypto"
            badge="Em breve"
            badgeColor="bg-blue-400/15 text-blue-300"
          >
            Arbitragem em <strong className="text-gray-200">mercados perpétuos</strong> entre exchanges,
            com cálculo de lucro líquido já considerando taxas.
          </FeatureCard>
          <FeatureCard
            icon={<LineChart size={22} />}
            title="Prime Analytix"
            badge="Em breve"
            badgeColor="bg-blue-400/15 text-blue-300"
          >
            Controle sua banca direto na plataforma — registre suas arbitragens pela calculadora,
            sem planilhas e sem sites de terceiros.
          </FeatureCard>
        </div>
      </section>

      {/* ===================== DIFERENCIAIS ===================== */}
      <section className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand-border bg-white/[0.02] p-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-400 ring-1 ring-green-500/20">
            <ServerCog size={22} />
          </div>
          <h3 className="text-xl font-bold text-white">Independência total</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Diferente de 90% das plataformas, <strong className="text-gray-200">não usamos APIs prontas</strong> como
            surebet.com. Todo o sistema — dos crawlers que coletam odds ao cálculo de arbitragem — é{" "}
            <strong className="text-gray-200">100% processado nos nossos servidores</strong>.
          </p>
        </div>
        <div className="rounded-2xl border border-brand-border bg-white/[0.02] p-7">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-400 ring-1 ring-green-500/20">
            <Zap size={22} />
          </div>
          <h3 className="text-xl font-bold text-white">Foco no mercado brasileiro</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-400">
            Nossa base de surebets é <strong className="text-gray-200">totalmente focada em casas brasileiras</strong>,
            oferecendo maior precisão, cobertura de mercados e aderência à realidade de quem aposta no Brasil.
          </p>
        </div>
      </section>

      {/* ===================== ROADMAP ===================== */}
      <section className="mt-12">
        <h2 className="mb-6 text-2xl font-bold text-white">Roadmap</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              phase: "Fase 1",
              icon: <CheckCircle2 size={18} />,
              title: "Monitoramento + calculadora",
              desc: "Crypto e apostas com calculadora integrada.",
              done: true,
            },
            {
              phase: "Fase 2",
              icon: <Sparkles size={18} />,
              title: "Área do usuário",
              desc: "Favoritos e alertas personalizados.",
              done: false,
            },
            {
              phase: "Fase 3",
              icon: <Bot size={18} />,
              title: "Execução assistida",
              desc: "Ordens automatizadas (cripto) e entrada assistida (apostas).",
              done: false,
            },
          ].map((r) => (
            <div
              key={r.phase}
              className={`relative rounded-2xl border p-6 ${
                r.done ? "border-green-500/30 bg-green-500/[0.04]" : "border-brand-border bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{r.phase}</span>
                <span className={r.done ? "text-green-400" : "text-gray-600"}>{r.icon}</span>
              </div>
              <h3 className="mt-3 font-semibold text-white">{r.title}</h3>
              <p className="mt-1 text-sm text-gray-400">{r.desc}</p>
              <span
                className={`mt-4 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                  r.done ? "bg-green-500/15 text-green-300" : "bg-white/5 text-gray-400"
                }`}
              >
                {r.done ? "Concluído" : "Em desenvolvimento"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== DISCORD CTA ===================== */}
      <section className="mt-12">
        <div className="relative overflow-hidden rounded-3xl border border-brand-border bg-gradient-to-r from-brand-sidebar/60 to-brand-active/20 p-8 sm:p-10">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-green-500/20 blur-[80px]" />
          <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
                <MessageCircle size={24} className="text-green-400" />
                Comunidade no Discord
              </h2>
              <p className="mt-2 max-w-xl text-sm text-gray-300">
                Promoções e bônus exclusivos de casas parceiras, compartilhamento de entradas,
                métodos avançados (como uso de <strong>delay</strong>) e suporte direto da equipe.
              </p>
            </div>
            <a
              href="https://discord.gg/gTfDKZscDx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-brand-dark transition-all hover:bg-green-400 hover:shadow-[0_0_25px_-5px] hover:shadow-green-500/50"
            >
              <MessageCircle size={18} />
              Entrar no Discord
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-gray-600">
        ArbPrime · Arbitragem esportiva e cripto · Feito no Brasil 🇧🇷
      </p>
    </div>
  );
}
