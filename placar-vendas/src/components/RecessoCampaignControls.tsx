import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Monitor, SlidersHorizontal } from 'lucide-react';
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

  return <section aria-label="Exibição da Meta Recesso" className="mt-5 rounded-xl border border-zinc-700 bg-zinc-900 p-4">
    <div className="flex flex-wrap items-end gap-3">
      <button aria-expanded={details} aria-controls="recesso-settings" onClick={() => setDetails(!details)} className="mr-auto flex items-center gap-2 self-center py-2 text-left text-sm font-bold text-white hover:text-emerald-300">
        <SlidersHorizontal size={17} aria-hidden="true" /> Gerenciar Meta Recesso <ChevronDown size={15} aria-hidden="true" className={details ? 'rotate-180' : ''} />
      </button>
      <label className="min-w-40 flex-1 text-xs font-semibold text-zinc-300 sm:max-w-64">Exibir em
        <select value={target} disabled={busy} onChange={event => { setTarget(event.target.value); setNotice(''); }} className="mt-1 w-full rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white">
          <option value="*">Todas as TVs do INSS</option>
          {[...known].sort().filter(name => name !== '*').map(name => <option value={name} key={name}>{name}</option>)}
          <option value="">Outra TV…</option>
        </select>
      </label>
      {target === '' && <label className="text-xs text-zinc-300">Nome usado na TV
        <input value={custom} onChange={event => { setCustom(event.target.value); setNotice(''); }} maxLength={100} className="mt-1 block rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white" />
      </label>}
      <button type="button" onClick={() => void setActive(mixed || !active)} disabled={busy || !snapshot || !selected || (target === '' && selected === '*')} className="flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-300 disabled:opacity-50">
        <Monitor size={17} aria-hidden="true" /> {active && !mixed ? 'Voltar ao placar INSS' : 'Ativar placar Meta Recesso'}
      </button>
      {mixed && <button type="button" disabled={busy} onClick={() => void setActive(false)} className="py-2 text-sm font-semibold text-zinc-200 underline">Voltar todas ao INSS</button>}
    </div>
    <div aria-live="polite" className="mt-2 text-right text-xs text-zinc-300">
      {error ? <><span className="text-amber-200">{error}</span> <button className="ml-2 underline" onClick={() => void refresh()}>Tentar novamente</button></> : notice || (snapshot ? (mixed ? 'As TVs do INSS estão exibindo placares diferentes.' : active ? 'Exibição atual: Meta Recesso' : 'Exibição atual: placar INSS') : 'Consultando exibição…')}
    </div>
    {details && snapshot && <div id="recesso-settings" className="mt-4 border-t border-zinc-700 pt-4">
      <p className="mb-3 text-sm text-zinc-300">Campanha de <strong>{shortRecessoDate(snapshot.startDate)} a {shortRecessoDate(snapshot.endDate)}</strong>. Os cadastros pagos e pendentes das equipes do INSS contam para a meta conjunta de {formatCents(snapshot.goalCents)}.</p>
      {snapshot.sourceStatus.state === 'error' && <p role="status" className="mb-4 text-xs text-amber-200">A origem INSS está indisponível. A consulta e os ajustes continuam com os dados gravados da campanha.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {snapshot.teams.map(team => <div key={team.id} className="rounded-lg bg-zinc-950 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-base font-bold">{team.name}</h3><span className="text-sm text-zinc-300">{team.sellerCount} vendedores</span></div>
          {team.sourceTeamName && <p className="mt-1 text-xs font-semibold text-emerald-300">{team.sourceTeamName}</p>}
          <p className="mt-1 text-xs text-zinc-400">{team.members.map(member => member.name).join(', ') || 'Aguardando a composição do INSS.'}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-300"><div><dt>Diário</dt><dd className="text-sm font-semibold text-white">{formatCents(team.dayCents)}</dd></div><div><dt>Semana</dt><dd className="text-sm font-semibold text-white">{formatCents(team.weekCents)}</dd></div></dl>
          <RecessoTeamEditor team={team} dates={snapshot.dates} today={snapshot.today} onSaved={acceptSnapshot} />
        </div>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">O fechamento do Diário mantém a semana e o histórico das duas equipes.</p>
        <button type="button" disabled={busy || snapshot.dayCents === 0} onClick={() => void closeDay()} className="rounded-md border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-300 disabled:opacity-50">Zerar Diário da campanha</button>
      </div>
    </div>}
  </section>;
}
