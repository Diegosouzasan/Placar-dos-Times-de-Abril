import { ArrowLeft, CalendarDays, Settings, Trophy } from 'lucide-react';
import type { CSSProperties } from 'react';
import { recessoWeekdays } from '../services/recesso';
import { ScoreboardTitle, ScoreboardLogo, TeamCrest } from './ScoreboardBrand';
import './RecessoBoard.css';

export interface RecessoTeamView {
  id: number | string;
  name: string;
  sourceTeamName: string;
  sellerCount: number;
  periodSold: number;
  daily: { goal: number | null; sold: number; remaining: number | null };
  weekly: { goal: number | null; sold: number; remaining: number | null };
  weeks: {
    label?: string;
    days: { date?: string | null; amount: number | null }[];
    total: number | null;
    current?: boolean;
  }[];
}

export interface RecessoBoardData {
  goal: number;
  sold: number;
  remaining: number;
  daysRemaining: number;
  perDay: number | null;
  perSeller: number | null;
  teams: RecessoTeamView[];
  startDate?: string;
  endDate?: string;
  asOf?: string;
  prizes?: string;
  notice?: string;
}

interface RecessoBoardProps {
  data: RecessoBoardData;
  onBack?: () => void;
  onAdmin?: () => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const shortDateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

function value(amount: number | null | undefined) {
  return amount == null || !Number.isFinite(amount) ? '—' : currency.format(amount).replace(/\s/, ' ');
}

function shortDate(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso.slice(0, 10) + 'T12:00:00');
  return Number.isNaN(date.getTime()) ? '' : shortDateFormat.format(date);
}

function HistoryAmount({ amount }: { amount: number | null }) {
  const text = value(amount).replace(/^R\$\s*/, '');
  return (
    <span className="rc-amount-width" style={{ '--rc-amount-length': text.length } as CSSProperties}>
      <span className="rc-cell-value">{text}</span>
    </span>
  );
}

function TeamHistory({ team }: { team: RecessoTeamView }) {
  return (
    <div className="rc-history">
      <table aria-label={`Vendas por dia e semana de ${team.name}, em reais`}>
        <thead>
          <tr><th scope="col">Dia</th>{team.weeks.map((week, i) => (
            <th key={i} scope="col" className={week.current ? 'rc-current' : ''} aria-current={week.current ? 'date' : undefined}>
              {week.label || `Sem. ${i + 1}`}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {recessoWeekdays.map((weekday, dayIndex) => (
            <tr key={weekday}><th scope="row">{weekday}</th>{team.weeks.map((week, i) => {
              const day = week.days[dayIndex];
              const hasValue = day?.amount != null && day.amount > 0;
              return (
                <td key={i} className={hasValue ? 'rc-filled' : 'rc-empty'}>
                  <div className="rc-cell">
                    {day?.date && <time className="rc-cell-date" dateTime={day.date}>{shortDate(day.date)}</time>}
                    {hasValue && <HistoryAmount amount={day.amount} />}
                  </div>
                </td>
              );
            })}</tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th scope="row">Total</th>{team.weeks.map((week, i) => (
            <td key={i}><HistoryAmount amount={week.total} /></td>
          ))}</tr>
        </tfoot>
      </table>
    </div>
  );
}

function TeamBlock({ team }: { team: RecessoTeamView }) {
  return (
    <article className="rc-team">
      <div className="rc-panel rc-team-summary">
        <header className="rc-team-heading">
          {team.sourceTeamName && <TeamCrest name={team.sourceTeamName} className="rc-crest" />}
          <div className="rc-team-identity">
            <h2>{team.name}</h2>
            {team.sourceTeamName && <p>{team.sourceTeamName}</p>}
          </div>
          <div className="rc-team-total"><span>Venda total</span><strong>{value(team.periodSold)}</strong></div>
        </header>
        <table className="rc-targets" aria-label={`Metas de ${team.name}`}>
          <thead><tr><th scope="col">Período</th><th scope="col">Meta</th><th scope="col">Vendido</th><th scope="col">Falta</th></tr></thead>
          <tbody>{([['Venda dia', team.daily], ['Por semana', team.weekly]] as const).map(([label, row]) => (
            <tr key={label}><th scope="row">{label}</th><td>{value(row.goal)}</td><td className="rc-sold">{value(row.sold)}</td><td className={row.remaining === 0 ? 'rc-sold' : 'rc-remaining'}>{value(row.remaining)}</td></tr>
          ))}</tbody>
        </table>
      </div>
      <TeamHistory team={team} />
    </article>
  );
}

function OverviewMetric({ label, reading, className }: { label: string; reading: string; className?: string }) {
  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{reading.startsWith('R$ ')
        ? <><span className="rc-currency">R$</span> {reading.slice(3)}</>
        : reading}</dd>
    </div>
  );
}

function CampaignOverview({ data }: { data: RecessoBoardData }) {
  const progress = data.goal > 0 ? Math.max(0, data.sold / data.goal * 100) : 0;
  return (
    <section className="rc-overview rc-panel" aria-label="Resultado da campanha">
      <dl className="rc-metrics">
        <OverviewMetric label="Já vendidos" reading={value(data.sold)} className="rc-sold" />
        <OverviewMetric label="Meta de cadastro" reading={value(data.goal)} />
        <OverviewMetric label="Falta para a meta" reading={value(data.remaining)} className={data.remaining === 0 ? 'rc-sold' : undefined} />
        <OverviewMetric label="Dias restantes" reading={String(data.daysRemaining)} />
        <OverviewMetric label="Por dia" reading={value(data.perDay)} />
        <OverviewMetric label="Por vendedor" reading={value(data.perSeller)} />
      </dl>
      <div className="rc-progress">
        <span>Progresso da meta</span>
        <div className="rc-track" role="progressbar" aria-label="Progresso da meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, progress)}>
          <span style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <b>{number.format(progress)}%</b>
      </div>
    </section>
  );
}

interface PortraitPerson {
  name: string;
  src: string;
  scale?: number;
  shiftY?: string;
  z?: number;
}

const leftSellers: PortraitPerson[] = [
  { name: 'Anny', src: '/img/recesso/anny.png', scale: 0.96, shiftY: '2%', z: 3 },
  { name: 'Cris', src: '/img/recesso/cris.png', scale: 1.03, shiftY: '0%', z: 5 },
  { name: 'Ileno', src: '/img/recesso/ileno.png', scale: 0.98, shiftY: '-2%', z: 2 },
  { name: 'Leilane', src: '/img/recesso/leilane.png', scale: 1.02, shiftY: '1%', z: 6 },
  { name: 'Laiane', src: '/img/recesso/laiane.png', scale: 1.0, shiftY: '3%', z: 5 },
  { name: 'Fernanda', src: '/img/recesso/fernanda.png', scale: 1.02, shiftY: '2%', z: 4 },
  { name: 'Leticia', src: '/img/recesso/leticia.png', scale: 0.84, shiftY: '7%', z: 3 },
  { name: 'Mateus', src: '/img/recesso/mateus.png', scale: 0.92, shiftY: '6%', z: 4 },
];

const rightSellers: PortraitPerson[] = [
  { name: 'Grazy', src: '/img/recesso/grazy.png', scale: 0.96, shiftY: '3%', z: 4 },
  { name: 'Stefanie', src: '/img/recesso/stefanie.png', scale: 1.01, shiftY: '1%', z: 5 },
  { name: 'Bianca', src: '/img/recesso/bianca.png', scale: 1.02, shiftY: '-1%', z: 3 },
  { name: 'Ketlhyn', src: '/img/recesso/ketlhyn.png', scale: 1.05, shiftY: '0%', z: 6 },
  { name: 'Klara', src: '/img/recesso/klara.png', scale: 0.98, shiftY: '3%', z: 4 },
  { name: 'Bruno', src: '/img/recesso/bruno.png', scale: 0.91, shiftY: '4%', z: 5 },
];

function TeamPortraits() {
  return (
    <div className="rc-portraits" aria-hidden="true">
      {/* Líder e vendedores - Time Ivanize (Esquerda) */}
      <div className="rc-side rc-side-left">
        <img
          src="/img/recesso/ivanize.png"
          alt=""
          className="rc-leader-photo rc-leader-left"
          decoding="async"
        />
        <div className="rc-seller-row rc-seller-row-left">
          {leftSellers.map(person => (
            <div
              key={person.name}
              className="rc-seller-slot"
              style={{
                '--rc-p-scale': person.scale ?? 1,
                '--rc-p-y': person.shiftY ?? '0%',
                zIndex: person.z ?? 1,
              } as CSSProperties}
            >
              <img src={person.src} alt="" className="rc-seller-photo" decoding="async" />
            </div>
          ))}
        </div>
      </div>

      {/* Líder e vendedores - Time Claudenise (Direita) */}
      <div className="rc-side rc-side-right">
        <img
          src="/img/recesso/claudenise.png"
          alt=""
          className="rc-leader-photo rc-leader-right"
          decoding="async"
        />
        <div className="rc-seller-row rc-seller-row-right">
          {rightSellers.map(person => (
            <div
              key={person.name}
              className="rc-seller-slot"
              style={{
                '--rc-p-scale': person.scale ?? 1,
                '--rc-p-y': person.shiftY ?? '0%',
                zIndex: person.z ?? 1,
              } as CSSProperties}
            >
              <img src={person.src} alt="" className="rc-seller-photo" decoding="async" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RecessoBoard({ data, onBack, onAdmin }: RecessoBoardProps) {
  const start = shortDate(data.startDate);
  const end = shortDate(data.endDate);
  return (
    <main className="rc-board">
      <TeamPortraits />
      <div className="rc-page">
        <header className="rc-masthead">
          {onBack && <button className="rc-back" type="button" onClick={onBack} aria-label="Voltar ao menu"><ArrowLeft size={15} aria-hidden="true" /> Voltar</button>}
          <ScoreboardTitle>Meta Recesso</ScoreboardTitle>
          <div className="rc-tools">
            {start && end && <span className="rc-period"><CalendarDays aria-hidden="true" />{start} a {end}</span>}
            {onAdmin && <button type="button" onClick={onAdmin} aria-label="Administrar Meta Recesso" title="Administrar Meta Recesso"><Settings aria-hidden="true" /></button>}
          </div>
        </header>
        {data.notice && <p className="rc-notice" role="status">{data.notice}</p>}
        <CampaignOverview data={data} />
        <section className="rc-teams" aria-label="Resultados dos times">
          {data.teams.map(team => <TeamBlock team={team} key={team.id} />)}
        </section>
        <section className="rc-prizes rc-panel" aria-labelledby="rc-prizes-title">
          <Trophy aria-hidden="true" />
          <div><h2 id="rc-prizes-title">Premiações</h2>
          {data.prizes && <p>{data.prizes}</p>}</div>
        </section>
        <footer className="rc-brand"><ScoreboardLogo /></footer>
      </div>
    </main>
  );
}

export default RecessoBoard;
