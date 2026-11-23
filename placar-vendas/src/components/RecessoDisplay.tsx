import RecessoBoard, { type RecessoBoardData } from './RecessoBoard'
import { recessoDayCents, recessoHistoryWeeks, recessoPeriodTotalCents, type RecessoSnapshot } from '../services/recesso'

function boardView(snapshot: RecessoSnapshot, error: string): RecessoBoardData {
  const { dates, today, daysRemaining, sourceStatus } = snapshot
  const groups = recessoHistoryWeeks(dates)
  const sourceNotice = sourceStatus.state === 'error' ? 'Sincronização com o INSS interrompida.'
    : !sourceStatus.lastSuccessAt ? 'Buscando os cadastros e os vendedores do INSS…' : ''
  const lastUpdate = sourceStatus.lastSuccessAt && new Date(sourceStatus.lastSuccessAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  return {
    goal: snapshot.goalCents / 100, sold: snapshot.soldCents / 100,
    remaining: snapshot.remainingCents / 100, daysRemaining,
    perDay: daysRemaining ? snapshot.dailyTargetCents / 100 : null,
    perSeller: daysRemaining && snapshot.sellerCount ? snapshot.perSellerCents / 100 : null,
    startDate: snapshot.startDate, endDate: snapshot.endDate,
    notice: [error || sourceNotice, (error || sourceNotice) && lastUpdate ? 'Última leitura do INSS em ' + lastUpdate + '.' : ''].filter(Boolean).join(' '),
    teams: snapshot.teams.map(team => {
      const targetsDefined = snapshot.sellerCount > 0 && daysRemaining > 0
      function period(goal: number, sold: number) {
        return { goal: targetsDefined ? goal / 100 : null, sold: sold / 100,
          remaining: targetsDefined ? Math.max(0, goal - sold) / 100 : null }
      }
      return {
        id: team.id, name: team.name, sourceTeamName: team.sourceTeamName,
        sellerCount: team.sellerCount, periodSold: recessoPeriodTotalCents(team) / 100,
        daily: period(team.dailyTargetCents, team.dayCents),
        weekly: period(team.weeklyTargetCents, team.weekCents),
        weeks: groups.map(group => {
          const cells = group.map(date => {
            const cents = date ? recessoDayCents(team, date, today) : null
            return { date, amount: cents === null ? null : cents / 100 }
          })
          return {
            days: cells, current: group.includes(today),
            total: cells.every(day => day.amount === null) ? null : group.reduce((sum, date) => sum + (date ? team.days[date] ?? 0 : 0), 0) / 100,
          }
        }),
      }
    }),
  }
}

export function RecessoDisplay({ snapshot, error }: { snapshot: RecessoSnapshot | null; error: string }) {
  if (!snapshot) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950 text-white">
      <h1 className="text-3xl font-bold">Meta Recesso</h1>
      <p role="status">{error || 'Carregando o placar…'}</p>
      <a href="#/" className="text-emerald-400 underline">Voltar ao menu</a>
    </main>
  )
  return <RecessoBoard data={boardView(snapshot, error)}
    onBack={() => { window.location.hash = '#/' }}
    onAdmin={() => { window.location.hash = '#/inss/admin/recesso' }} />
}
