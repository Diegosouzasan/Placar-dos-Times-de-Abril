import { useState } from 'react';
import {
  addRecessoEntry, recessoDayCents, recessoHistoryWeeks, recessoWeekdays, setRecessoDayTotal, setRecessoTeamTotal, shortRecessoDate,
  type RecessoSnapshot, type RecessoTeam,
} from '../services/recesso';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents: number) => currency.format(cents / 100);
type Edit = { kind: 'total' | 'day' | 'add', date: string, before: number, requestId: string };

function parseCents(input: string) {
  const value = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value.replace(/\./g, '').replace(',', '.')) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function newId() {
  // The control panel is also used from HTTP addresses on the local network.
  return globalThis.crypto?.randomUUID?.() ?? 'adm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export default function RecessoTeamEditor({ team, dates, today, onSaved }: {
  team: RecessoTeam;
  dates: string[];
  today: string;
  onSaved: (snapshot: RecessoSnapshot) => void;
}) {
  const [edit, setEdit] = useState<Edit | null>(null);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function begin(kind: Edit['kind'], date: string) {
    const before = kind === 'total' ? team.soldCents : team.days[date] || 0;
    setEdit({ kind, date, before, requestId: newId() });
    setAmount(kind === 'add' ? '' : (before / 100).toFixed(2).replace('.', ','));
    setMessage('');
  }

  const parsed = parseCents(amount);
  const liveValue = edit?.kind === 'total' ? team.soldCents : (team.days[edit?.date || ''] || 0);
  const stale = edit && edit.kind !== 'add' && liveValue !== edit.before;
  const defaultDate = dates.filter(date => date <= today).at(-1) ?? dates[0];
  const weeks = recessoHistoryWeeks(dates);

  async function save() {
    if (!edit || busy || stale) return;
    if (parsed === null || (edit.kind === 'add' && parsed === 0)) {
      setMessage('Informe um valor em reais, por exemplo 1.500,00.');
      return;
    }
    setBusy(true);
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
      setEdit(null);
      setMessage(edit.kind === 'add' ? 'Cadastro adicionado à campanha.' : 'Valor atualizado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 border-t border-zinc-700 pt-3">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-zinc-300">Total vendido até agora <strong className="block text-lg text-white">{money(team.soldCents)}</strong></p>
      <button type="button" disabled={busy} onClick={() => begin('total', today)} className="rounded-md border border-zinc-600 px-3 py-2 text-xs font-bold hover:border-emerald-400">Editar total</button>
    </div>
    <div className="flex items-center justify-between gap-2">
      <h4 className="text-sm font-semibold text-zinc-200">Histórico diário</h4>
      {defaultDate && <button type="button" disabled={busy} onClick={() => begin('add', defaultDate)} className="py-2 text-xs font-bold text-emerald-300 hover:underline">Adicionar cadastro</button>}
    </div>
    <table className="w-full table-fixed border-separate border-spacing-1" aria-label={'Histórico diário de ' + team.name}>
      <colgroup><col className="w-8" />{weeks.map(week => <col key={week[0]} />)}</colgroup>
      <thead><tr className="text-[10px] font-semibold text-zinc-400">
        <th scope="col" className="text-left">Dia</th>
        {weeks.map((week, index) => <th key={week[0]} scope="col">Sem. {index + 1}</th>)}
      </tr></thead>
      <tbody>{recessoWeekdays.map((weekday, index) => <tr key={weekday}>
        <th scope="row" className="text-left text-[11px] text-zinc-400">{weekday}</th>
        {weeks.map(week => {
          const date = week[index];
          if (!date) return <td key={week[0]} />;
          const cents = recessoDayCents(team, date, today);
          return <td key={date}><button type="button"
            aria-label={'Editar ' + team.name + ' em ' + shortRecessoDate(date) + ', ' + (cents === null ? 'sem lançamento' : money(cents))}
            aria-pressed={edit?.kind === 'day' && edit.date === date}
            disabled={busy} onClick={() => begin('day', date)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-0.5 py-2 text-center hover:border-emerald-400 focus-visible:outline-emerald-400 disabled:opacity-50 aria-pressed:border-emerald-400">
            <span className="block text-[11px] text-zinc-300">{shortRecessoDate(date)}</span>
            <span className="block break-all text-[10px] font-bold text-white">{cents === null ? '—' : money(cents)}</span>
          </button></td>;
        })}
      </tr>)}</tbody>
    </table>
    {edit && <form className="mt-3 rounded-md border border-zinc-700 bg-zinc-900 p-3" onSubmit={event => { event.preventDefault(); void save(); }}>
      <h4 className="mb-2 text-sm font-bold">{edit.kind === 'total' ? 'Editar total vendido' : edit.kind === 'day' ? 'Editar dia ' + shortRecessoDate(edit.date) : 'Adicionar cadastro'}</h4>
      {edit.kind === 'add' && <label className="mb-2 block text-xs text-zinc-300">Data do cadastro
        <select value={edit.date} disabled={busy} onChange={event => begin('add', event.target.value)} className="mt-1 block w-full rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white">
          {dates.map(date => <option key={date} value={date}>{shortRecessoDate(date)}</option>)}
        </select>
      </label>}
      <p className="mb-2 text-xs text-zinc-300">Valor atual: <strong>{money(liveValue)}</strong></p>
      <label className="block text-xs text-zinc-300">{edit.kind === 'add' ? 'Valor a somar (R$)' : 'Novo total (R$)'}
        <input key={edit.kind + edit.date} className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
          inputMode="decimal" value={amount} autoFocus disabled={busy} onFocus={event => event.target.select()} onChange={event => {
            setAmount(event.target.value); setEdit({ ...edit, requestId: newId() }); setMessage('');
          }} />
      </label>
      <p className="mt-2 text-xs text-zinc-400">{edit.kind === 'total'
        ? 'O total considera as vendas até hoje. A diferença fica como saldo a distribuir no histórico.'
        : edit.date > today ? 'O valor aparece no histórico ao salvar e entra no vendido na data escolhida.'
        : edit.kind === 'add' ? 'Use para cadastros ainda não lançados no INSS.' : 'Informe o valor completo deste dia para a equipe.'}</p>
      {edit.kind === 'add' && parsed !== null && <p className="mt-2 text-xs text-emerald-300">Novo total do dia: {money(liveValue + parsed)}</p>}
      {stale && <button type="button" onClick={() => begin(edit.kind, edit.date)} className="my-2 text-xs text-amber-200 underline">O valor mudou. Reabrir com o total atual.</button>}
      <div className="mt-3 flex gap-4 text-sm">
        <button type="submit" disabled={busy || Boolean(stale)} className="font-bold text-emerald-300 disabled:opacity-50">{busy ? 'Salvando…' : edit.kind === 'add' ? 'Somar valor' : 'Salvar total'}</button>
        <button type="button" disabled={busy} className="text-zinc-300" onClick={() => { setEdit(null); setMessage(''); }}>Cancelar</button>
      </div>
    </form>}
    {message && <p role="status" className="mt-2 text-xs text-amber-200">{message}</p>}
  </div>;
}
