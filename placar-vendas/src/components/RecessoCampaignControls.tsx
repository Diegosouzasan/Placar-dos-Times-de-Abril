import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, Monitor, RotateCcw, SlidersHorizontal, Target, TrendingUp, Users } from 'lucide-react';
import {
  getRecesso,
  isRecessoDestination,
  resetRecessoDay,
  saveRecessoConfig,
  shortRecessoDate,
  type RecessoSnapshot,
} from '../services/recesso';
import RecessoTeamEditor from './RecessoTeamEditor';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatCents = (cents: number) => currency.format(cents / 100);

function readTvName() {
  try {
    return localStorage.getItem('tvName')?.trim() || '';
  } catch {
    return '';
  }
}

export default function RecessoCampaignControls({ tvNames }: { tvNames: string[] }) {
  const [snapshot, setSnapshot] = useState<RecessoSnapshot | null>(null);
  const [thisTv] = useState(readTvName);
  const [target, setTarget] = useState(thisTv || '*');
  const [custom, setCustom] = useState('');
  const [details, setDetails] = useState(() => window.location.hash === '#/inss/admin/recesso');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const writeLock = useRef(false);
  const pendingClose = useRef<{ date: string, requestId: string } | null>(null);
  const sequence = useRef(0);

  function setEditorBusy(saving: boolean) {
    writeLock.current = saving;
    ++sequence.current;
    setBusy(saving);
  }

  const acceptSnapshot = useCallback((value: RecessoSnapshot) => {
    sequence.current += 1;
    setSnapshot(value);
    setError('');
  }, []);

  const refresh = useCallback(async () => {
    if (writeLock.current) return;
    const request = ++sequence.current;
    try {
      const result = await getRecesso();
      if (request === sequence.current) acceptSnapshot(result);
    } catch (cause) {
      if (request === sequence.current) setError(cause instanceof Error ? cause.message : 'Falha ao carregar a campanha.');
    }
  }, [acceptSnapshot]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { ++sequence.current; window.clearInterval(timer); };
  }, [refresh]);

  const known = new Set(tvNames.filter(Boolean));
  if (thisTv) known.add(thisTv);
  if (snapshot) {
    for (const key of Object.keys(snapshot.destinations)) {
      if (key.startsWith('INSS:') && key !== 'INSS:*') known.add(key.slice(5));
    }
  }
  if (target !== '*' && target !== '') known.add(target);
  const selected = target === '' ? custom.trim() : target;
  const individualDestinations = Object.entries(snapshot?.destinations || {}).filter(([key]) => key.startsWith('INSS:') && key !== 'INSS:*');
  const global = snapshot?.destinations['INSS:*'] === true;
  const mixed = selected === '*' && individualDestinations.some(([, active]) => active !== global);
  const active = selected && snapshot ? isRecessoDestination(snapshot, 'INSS', selected) : false;
  const destinationLabel = selected === '*' ? 'todas as TVs do INSS' : selected;

  const progressPct = snapshot && snapshot.goalCents > 0
    ? Math.min(100, (snapshot.soldCents / snapshot.goalCents) * 100)
    : 0;

  async function setActive(next: boolean) {
    if (writeLock.current || !selected || (target === '' && selected === '*')) return;
    writeLock.current = true;
    ++sequence.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const current = await getRecesso();
      const destinations: Record<string, boolean> = { ['INSS:' + selected]: next };
      if (selected === '*') {
        for (const key of Object.keys(current.destinations)) {
          if (key.startsWith('INSS:')) destinations[key] = next;
        }
      }
      const result = await saveRecessoConfig({ revision: current.revision, destinations });
      acceptSnapshot(result);
      if (target === '') setTarget(selected);
      setNotice((next ? 'Meta Recesso ativada' : 'Placar INSS restaurado') + ' para ' + destinationLabel + '.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao alterar a exibição. Tente novamente.');
    } finally {
      writeLock.current = false;
      setBusy(false);
    }
  }

  async function closeDay() {
    if (!snapshot || writeLock.current || !window.confirm('Zerar o Diário da Meta Recesso das duas equipes? O histórico, a semana e o total vendido serão preservados.')) return;
    writeLock.current = true;
    ++sequence.current;
    setBusy(true);
    setNotice('');
    try {
      if (pendingClose.current?.date !== snapshot.today) {
        pendingClose.current = {
          date: snapshot.today,
          requestId: globalThis.crypto?.randomUUID?.() ?? 'fechar-' + Date.now().toString(36) + Math.random().toString(36).slice(2),
        };
      }
      const result = await resetRecessoDay(pendingClose.current);
      pendingClose.current = null;
      acceptSnapshot(result);
      setNotice('Diário da campanha zerado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao fechar o Diário da campanha.');
    } finally {
      writeLock.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Exibição da Meta Recesso"
      className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl backdrop-blur-sm overflow-hidden"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-zinc-900/95">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            aria-expanded={details}
            aria-controls="recesso-settings"
            onClick={() => setDetails(!details)}
            className="group flex items-center gap-2.5 rounded-xl border border-zinc-700/80 bg-zinc-950/70 px-3.5 py-2.5 text-left text-sm font-bold text-white transition-colors hover:border-emerald-500/60 hover:text-emerald-300"
          >
            <SlidersHorizontal size={16} aria-hidden="true" className="text-emerald-400 shrink-0" />
            <span>Gerenciar Meta Recesso</span>
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={`text-zinc-400 transition-transform duration-200 group-hover:text-emerald-300 ${details ? 'rotate-180' : ''}`}
            />
          </button>

          {snapshot && (
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide ${
                mixed
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : active
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-700 bg-zinc-800/70 text-zinc-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  mixed ? 'bg-amber-400' : active ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'
                }`}
              />
              {mixed ? 'Exibição mista' : active ? 'Meta Recesso ativa' : 'Placar INSS ativo'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[200px] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Exibir em
            <select
              value={target}
              disabled={busy}
              onChange={event => { setTarget(event.target.value); setNotice(''); }}
              className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white outline-none focus:border-emerald-400"
            >
              <option value="*">Todas as TVs do INSS</option>
              {[...known].sort().filter(name => name !== '*').map(name => (
                <option value={name} key={name}>{name}</option>
              ))}
              <option value="">Outra TV…</option>
            </select>
          </label>

          {target === '' && (
            <label className="min-w-[180px] text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Nome usado na TV
              <input
                value={custom}
                onChange={event => { setCustom(event.target.value); setNotice(''); }}
                maxLength={100}
                placeholder="Ex: TV Recepção"
                className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white outline-none focus:border-emerald-400"
              />
            </label>
          )}

          <button
            type="button"
            onClick={() => void setActive(mixed || !active)}
            disabled={busy || !snapshot || !selected || (target === '' && selected === '*')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all disabled:opacity-50 ${
              active && !mixed
                ? 'border border-zinc-600 bg-zinc-800 text-white hover:border-zinc-400 hover:bg-zinc-700'
                : 'bg-emerald-400 text-zinc-950 shadow-[0_0_16px_rgba(52,211,153,0.2)] hover:bg-emerald-300'
            }`}
          >
            <Monitor size={16} aria-hidden="true" />
            {active && !mixed ? 'Voltar ao placar INSS' : 'Ativar placar Meta Recesso'}
          </button>

          {mixed && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void setActive(false)}
              className="py-2 text-xs font-semibold text-zinc-300 underline hover:text-white"
            >
              Voltar todas ao INSS
            </button>
          )}
        </div>
      </div>

      {/* Live status bar */}
      {(error || notice || !snapshot) && (
        <div
          aria-live="polite"
          className={`flex items-center justify-between gap-2 border-t px-5 py-2 text-xs ${
            error
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-zinc-800 bg-zinc-950/50 text-zinc-300'
          }`}
        >
          <span>
            {error || notice || 'Consultando exibição da campanha…'}
          </span>
          {error && (
            <button
              type="button"
              className="font-semibold underline hover:text-white"
              onClick={() => void refresh()}
            >
              Tentar novamente
            </button>
          )}
        </div>
      )}

      {/* Expanded Meta Recesso Control Area */}
      {details && snapshot && (
        <div id="recesso-settings" className="border-t border-zinc-800 bg-zinc-950/40 p-5 space-y-6">
          {/* Campaign Summary Strip */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <CalendarDays size={16} className="text-emerald-400 shrink-0" aria-hidden="true" />
                <span>
                  Campanha de <strong className="text-white">{shortRecessoDate(snapshot.startDate)} a {shortRecessoDate(snapshot.endDate)}</strong>
                  <span className="mx-2 text-zinc-600">•</span>
                  Meta conjunta de <strong className="text-emerald-300">{formatCents(snapshot.goalCents)}</strong>
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-300 tabular-nums">
                {snapshot.daysRemaining} {snapshot.daysRemaining === 1 ? 'dia útil restante' : 'dias úteis restantes'}
              </span>
            </div>

            {snapshot.sourceStatus.state === 'error' && (
              <p role="status" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                A origem INSS está indisponível. A consulta e os ajustes continuam com os dados gravados da campanha.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3.5 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <TrendingUp size={12} className="text-emerald-400" aria-hidden="true" /> Vendido total
                </span>
                <strong className="mt-1 block text-lg font-bold text-white tabular-nums">
                  {formatCents(snapshot.soldCents)}
                </strong>
                <span className="text-[11px] text-emerald-400 font-semibold tabular-nums">
                  {progressPct.toFixed(1).replace('.', ',')}% da meta
                </span>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3.5 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  <Target size={12} className="text-amber-400" aria-hidden="true" /> Falta p/ meta
                </span>
                <strong className="mt-1 block text-lg font-bold text-white tabular-nums">
                  {formatCents(snapshot.remainingCents)}
                </strong>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  Meta/dia: {formatCents(snapshot.dailyTargetCents)}
                </span>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3.5 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Diário (2 times)
                </span>
                <strong className="mt-1 block text-lg font-bold text-emerald-300 tabular-nums">
                  {formatCents(snapshot.dayCents)}
                </strong>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  Hoje ({shortRecessoDate(snapshot.today)})
                </span>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/70 px-3.5 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Semana (2 times)
                </span>
                <strong className="mt-1 block text-lg font-bold text-white tabular-nums">
                  {formatCents(snapshot.weekCents)}
                </strong>
                <span className="text-[11px] text-zinc-400 tabular-nums">
                  Por vendedor/dia: {formatCents(snapshot.perSellerCents)}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Teams Stacked Vertically (Full Width so all 6 weeks fit cleanly without clipping) */}
          <div className="space-y-6">
            {snapshot.teams.map(team => (
              <article
                key={team.id}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-md"
              >
                {/* Team Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-zinc-800/90">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-lg font-bold text-white">{team.name}</h3>
                      {team.sourceTeamName && (
                        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                          {team.sourceTeamName}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      {team.members.map(member => member.name).join(' • ') || 'Aguardando a composição do INSS.'}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300">
                    <Users size={14} className="text-emerald-400" aria-hidden="true" />
                    {team.sellerCount} {team.sellerCount === 1 ? 'vendedor' : 'vendedores'}
                  </span>
                </div>

                {/* Team KPIs + Calendar Editor */}
                <RecessoTeamEditor
                  team={team}
                  dates={snapshot.dates}
                  today={snapshot.today}
                  onSaved={acceptSnapshot}
                  disabled={busy}
                  onSavingChange={setEditorBusy}
                />
              </article>
            ))}
          </div>

          {/* Footer Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
            <p className="text-xs text-zinc-400">
              O fechamento do Diário zera apenas o contador do dia de hoje, mantendo a semana, o histórico e o acumulado das duas equipes.
            </p>
            <button
              type="button"
              disabled={busy || snapshot.dayCents === 0}
              onClick={() => void closeDay()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-40"
            >
              <RotateCcw size={13} aria-hidden="true" />
              Zerar Diário da campanha
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
