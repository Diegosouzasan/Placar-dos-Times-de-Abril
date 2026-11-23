import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import {
  addRecessoEntry,
  recessoDayCents,
  recessoHistoryWeeks,
  recessoWeekdays,
  setRecessoDayTotal,
  setRecessoTeamTotal,
  shortRecessoDate,
  type RecessoSnapshot,
  type RecessoTeam,
} from '../services/recesso';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents: number) => currency.format(cents / 100);
const cellMoney = (cents: number) => money(cents).replace(/^R\$\s*/, '');
type Edit = { kind: 'total' | 'day' | 'add', date: string, before: number, requestId: string };

function parseCents(input: string) {
  const value = input.trim().replace(/^R\$\s*/i, '');
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function newId() {
  // The control panel is also used from HTTP addresses on the local network.
  return globalThis.crypto?.randomUUID?.() ?? 'adm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export default function RecessoTeamEditor({ team, dates, today, onSaved, disabled, onSavingChange }: {
  team: RecessoTeam;
  dates: string[];
  today: string;
  onSaved: (snapshot: RecessoSnapshot) => void;
  disabled: boolean;
  onSavingChange: (busy: boolean) => void;
}) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const writeLock = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  function begin(kind: Edit['kind'], date: string, button?: HTMLButtonElement) {
    if (busy || disabled || (kind !== 'total' && date > today)) return;
    if (button) trigger.current = button;
    const before = kind === 'total' ? team.soldCents : team.days[date] || 0;
    setEdit({ kind, date, before, requestId: newId() });
    setAmount(kind === 'add' ? '' : (before / 100).toFixed(2).replace('.', ','));
    setMessage('');
    setFailed(false);
  }

  function close() {
    setEdit(null);
    // Wait for the disabled state to clear after a successful save.
    requestAnimationFrame(() => trigger.current?.focus());
  }

  // Close modal with Escape key
  useEffect(() => {
    if (!edit) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        setEdit(null);
        setMessage('');
        requestAnimationFrame(() => trigger.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [edit, busy]);

  const parsed = parseCents(amount);
  const liveValue = edit?.kind === 'total' ? team.soldCents : (team.days[edit?.date || ''] || 0);
  const stale = edit && edit.kind !== 'add' && liveValue !== edit.before;
  const availableDates = dates.filter(date => date <= today);
  const defaultDate = availableDates.at(-1);
  const weeks = recessoHistoryWeeks(dates);
  const editorId = 'recesso-edit-' + team.id;

  // Calculate live previews for the modal
  const editDelta = edit && parsed !== null
    ? (edit.kind === 'add' ? parsed : parsed - edit.before)
    : null;
  const editingWeek = edit ? weeks.find(week => week.includes(edit.date)) : undefined;
  const editingWeekCurrentTotal = editingWeek
    ? editingWeek.reduce((sum, d) => sum + (d && d <= today ? (team.days[d] ?? 0) : 0), 0)
    : 0;
  const isEditingCurrentWeek = Boolean(editingWeek?.includes(today));

  async function save() {
    if (!edit || disabled || writeLock.current || stale) return;
    if (parsed === null || (edit.kind === 'add' && parsed === 0)) {
      setFailed(true);
      setMessage('Informe um valor em reais, por exemplo 1.500,00.');
      return;
    }
    writeLock.current = true;
    setBusy(true);
    onSavingChange(true);
    setFailed(false);
    setMessage('');
    try {
      const input = { requestId: edit.requestId, teamId: team.id, amountCents: parsed };
      let snapshot: RecessoSnapshot;
      if (edit.kind === 'total') {
        snapshot = await setRecessoTeamTotal({ ...input, expectedCents: edit.before });
      } else if (edit.kind === 'day') {
        snapshot = await setRecessoDayTotal({ ...input, date: edit.date, expectedCents: edit.before });
      } else {
        snapshot = await addRecessoEntry({ ...input, date: edit.date });
      }
      onSaved(snapshot);
      close();
      setMessage(edit.kind === 'add' ? 'Cadastro adicionado. Totais recalculados.' : 'Valor salvo. Dia, semana, acumulado e metas recalculados.');
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar. Tente novamente.');
    } finally {
      writeLock.current = false;
      setBusy(false);
      onSavingChange(false);
    }
  }

  return (
    <div className="mt-4 space-y-5">
      {/* Unified Team KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/70 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Diário (Hoje)
          </span>
          <strong className="mt-1 block text-xl font-bold text-emerald-300 tabular-nums">
            {money(team.dayCents)}
          </strong>
          {team.dailyTargetCents > 0 && (
            <span className="text-[11px] text-zinc-500 tabular-nums">
              Meta dia: {money(team.dailyTargetCents)}
            </span>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/70 px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Semana atual
          </span>
          <strong className="mt-1 block text-xl font-bold text-white tabular-nums">
            {money(team.weekCents)}
          </strong>
          {team.weeklyTargetCents > 0 && (
            <span className="text-[11px] text-zinc-500 tabular-nums">
              Meta semana: {money(team.weeklyTargetCents)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/90 bg-zinc-900/70 px-4 py-3">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Total vendido até agora
            </span>
            <strong className="mt-1 block text-xl font-bold text-white tabular-nums truncate">
              {money(team.soldCents)}
            </strong>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={event => begin('total', today, event.currentTarget)}
            className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-200 transition-colors hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          >
            Editar total
          </button>
        </div>
      </div>

      {/* Daily History Section Header */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-zinc-100">Histórico diário (R$)</h4>
            <p className="text-xs text-zinc-400">
              Clique no ícone de lápis em qualquer dia passado ou de hoje para corrigir o valor e recalcular automaticamente.
            </p>
          </div>
          {defaultDate && (
            <button
              type="button"
              disabled={disabled}
              onClick={event => begin('add', defaultDate, event.currentTarget)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <Plus size={14} aria-hidden="true" />
              Adicionar cadastro
            </button>
          )}
        </div>

        {/* Organized Full-Width Calendar Grid */}
        <div
          className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3"
          role="region"
          aria-label={'Calendário de ' + team.name}
          tabIndex={0}
        >
          <table
            className="w-full min-w-[740px] table-fixed border-separate border-spacing-2 tabular-nums"
            aria-label={'Histórico diário de ' + team.name}
          >
            <colgroup>
              <col className="w-14" />
              {weeks.map((_, index) => <col key={index} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="pb-1 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Dia
                </th>
                {weeks.map((week, index) => {
                  const isCurrentWeek = week.includes(today);
                  return (
                    <th
                      key={index}
                      scope="col"
                      className={`pb-1 text-center text-xs font-bold uppercase tracking-wider ${
                        isCurrentWeek ? 'text-emerald-400' : 'text-zinc-400'
                      }`}
                    >
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 ${
                        isCurrentWeek ? 'bg-emerald-500/15 border border-emerald-500/30' : ''
                      }`}>
                        Sem. {index + 1}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {recessoWeekdays.map((weekday, index) => (
                <tr key={weekday}>
                  <th
                    scope="row"
                    className="text-left text-xs font-bold uppercase tracking-wider text-zinc-400"
                  >
                    {weekday}
                  </th>
                  {weeks.map((week, weekIndex) => {
                    const date = week[index];
                    if (!date) {
                      return (
                        <td key={weekIndex} className="align-middle">
                          <div className="flex h-[68px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800/80 bg-zinc-950/30 px-2 text-center select-none">
                            <span className="text-xs text-zinc-700">—</span>
                            <span className="text-[10px] font-medium text-zinc-600">Fora do período</span>
                          </div>
                        </td>
                      );
                    }
                    const cents = recessoDayCents(team, date, today);
                    const future = date > today;
                    const isToday = date === today;
                    const isEditingThis = edit?.kind === 'day' && edit.date === date;

                    return (
                      <td key={date} className="align-middle">
                        <button
                          type="button"
                          aria-label={
                            (future ? 'Dia futuro de ' : 'Editar ') +
                            team.name +
                            ' em ' +
                            shortRecessoDate(date) +
                            ', ' +
                            (cents === null ? 'sem lançamento' : money(cents))
                          }
                          aria-expanded={isEditingThis}
                          aria-controls={isEditingThis ? editorId : undefined}
                          aria-current={isToday ? 'date' : undefined}
                          disabled={disabled || future}
                          onClick={event => begin('day', date, event.currentTarget)}
                          className={`group flex h-[68px] w-full flex-col justify-between rounded-lg border px-2.5 py-2 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                            future
                              ? 'cursor-not-allowed border-zinc-800/70 bg-zinc-950/40 opacity-45'
                              : isToday
                                ? 'border-emerald-500/70 bg-emerald-950/60 shadow-[0_0_12px_rgba(16,185,129,0.15)] hover:border-emerald-400 hover:bg-emerald-950/80'
                                : isEditingThis
                                  ? 'border-emerald-400 bg-zinc-900 ring-1 ring-emerald-400/50'
                                  : 'border-zinc-800 bg-zinc-900/90 hover:border-emerald-400/70 hover:bg-zinc-800/80'
                          }`}
                        >
                          <span className="flex w-full items-center justify-between gap-1">
                            <span className="flex items-center gap-1.5">
                              <time
                                dateTime={date}
                                className={`text-xs font-semibold ${
                                  isToday ? 'text-emerald-300' : future ? 'text-zinc-500' : 'text-zinc-400'
                                }`}
                              >
                                {shortRecessoDate(date)}
                              </time>
                              {isToday && (
                                <span className="rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-300">
                                  Hoje
                                </span>
                              )}
                            </span>
                            {!future && (
                              <span className="rounded p-0.5 text-emerald-400/75 transition-colors group-hover:bg-emerald-500/15 group-hover:text-emerald-300">
                                <Pencil size={13} aria-hidden="true" />
                              </span>
                            )}
                          </span>
                          <span
                            className={`block w-full truncate text-sm font-bold whitespace-nowrap ${
                              cents === null
                                ? 'text-zinc-600'
                                : cents === 0
                                  ? 'text-zinc-400'
                                  : isToday
                                    ? 'text-emerald-200'
                                    : 'text-white'
                            }`}
                          >
                            {cents === null ? '—' : cellMoney(cents)}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="pt-1 text-left text-xs font-bold uppercase tracking-wider text-zinc-300"
                >
                  Total
                </th>
                {weeks.map((week, index) => {
                  const hasStarted = week.some(date => date && date <= today);
                  const weekSum = week.reduce(
                    (sum, date) => sum + (date && date <= today ? (team.days[date] ?? 0) : 0),
                    0
                  );
                  const isCurrentWeek = week.includes(today);
                  return (
                    <td key={index} className="pt-1">
                      <div
                        className={`rounded-lg border px-2.5 py-2 text-center text-xs font-bold whitespace-nowrap truncate ${
                          isCurrentWeek
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : hasStarted
                              ? 'border-zinc-800 bg-zinc-950/90 text-zinc-100'
                              : 'border-zinc-800/50 bg-zinc-950/30 text-zinc-600'
                        }`}
                      >
                        {hasStarted ? cellMoney(weekSum) : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Feedback Banner */}
      {message && !edit && (
        <p
          role={failed ? 'alert' : 'status'}
          className={`rounded-lg border px-3.5 py-2 text-xs font-medium ${
            failed
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {message}
        </p>
      )}

      {/* Clean Modal Dialog for Editing Day / Adding Entry / Editing Total */}
      {edit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={event => {
            if (event.target === event.currentTarget && !busy) {
              close();
              setMessage('');
            }
          }}
        >
          <form
            id={editorId}
            role="dialog"
            aria-modal="true"
            aria-label={'Editar valores de ' + team.name}
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            onSubmit={event => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  {team.name}
                </span>
                <h4 className="mt-0.5 text-lg font-bold text-white">
                  {edit.kind === 'total'
                    ? 'Editar total vendido'
                    : edit.kind === 'day'
                      ? `Editar dia ${shortRecessoDate(edit.date)}`
                      : 'Adicionar cadastro'}
                </h4>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => { close(); setMessage(''); }}
                aria-label="Fechar"
                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {edit.kind === 'add' && (
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Data do cadastro
                  <select
                    value={edit.date}
                    disabled={busy}
                    onChange={event => begin('add', event.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white outline-none focus:border-emerald-400"
                  >
                    {availableDates.map(date => (
                      <option key={date} value={date}>
                        {shortRecessoDate(date)}{date === today ? ' (Hoje)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/70 px-3.5 py-2.5 text-xs">
                <span className="text-zinc-400">Valor atual</span>
                <strong className="text-sm font-bold text-white tabular-nums">{money(liveValue)}</strong>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
                {edit.kind === 'add'
                  ? 'Valor a somar (R$)'
                  : edit.kind === 'day'
                    ? 'Novo total do dia (R$)'
                    : 'Novo total acumulado (R$)'}
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                    R$
                  </span>
                  <input
                    key={edit.kind + edit.date}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2.5 pl-10 pr-3.5 text-base font-bold text-white tabular-nums outline-none focus:border-emerald-400"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={amount}
                    autoFocus
                    disabled={disabled}
                    aria-invalid={failed}
                    aria-describedby={editorId + '-help'}
                    onFocus={event => event.target.select()}
                    onChange={event => {
                      setAmount(event.target.value);
                      setEdit({ ...edit, requestId: newId() });
                      setMessage('');
                      setFailed(false);
                    }}
                  />
                </div>
              </label>

              <p id={editorId + '-help'} className="text-xs leading-relaxed text-zinc-400">
                {edit.kind === 'total'
                  ? 'A diferença fica como saldo anterior ao histórico. As próximas correções diárias alteram o acumulado.'
                  : edit.kind === 'add'
                    ? 'Use para somar cadastros ainda não lançados no INSS.'
                    : 'Informe o valor completo daquele dia. O diário, a semana, o total da equipe e as metas serão recalculados automaticamente.'}
              </p>

              {/* Live Recalculation Preview */}
              {editDelta !== null && !stale && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 space-y-1.5 text-xs">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Prévia após salvar
                  </span>
                  {edit.kind === 'add' && (
                    <div className="flex items-center justify-between text-zinc-200">
                      <span>Novo total do dia ({shortRecessoDate(edit.date)})</span>
                      <strong className="font-bold text-white tabular-nums">{money(liveValue + editDelta)}</strong>
                    </div>
                  )}
                  {edit.kind !== 'total' && editingWeek && (
                    <div className="flex items-center justify-between text-zinc-200">
                      <span>{isEditingCurrentWeek ? 'Semana atual' : 'Total da semana'}</span>
                      <strong className="font-bold text-white tabular-nums">
                        {money(Math.max(0, editingWeekCurrentTotal + editDelta))}
                      </strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-emerald-200 pt-1 border-t border-emerald-500/20">
                    <span>Total vendido da equipe</span>
                    <strong className="text-sm font-bold text-emerald-300 tabular-nums">
                      {money(Math.max(0, edit.kind === 'total' ? (parsed ?? team.soldCents) : team.soldCents + editDelta))}
                    </strong>
                  </div>
                </div>
              )}

              {stale && (
                <button
                  type="button"
                  onClick={() => begin(edit.kind, edit.date)}
                  className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
                >
                  O valor mudou desde que você abriu. Clique para atualizar com o valor atual.
                </button>
              )}

              {message && (
                <p role={failed ? 'alert' : 'status'} className={`text-xs font-medium ${failed ? 'text-amber-200' : 'text-emerald-300'}`}>
                  {message}
                </p>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                type="button"
                disabled={disabled}
                className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
                onClick={() => { close(); setMessage(''); }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={disabled || Boolean(stale)}
                className="rounded-lg bg-emerald-400 px-5 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
              >
                {busy ? 'Salvando…' : edit.kind === 'add' ? 'Somar valor' : 'Salvar valor'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
