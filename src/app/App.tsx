import { useCallback, useEffect, useState } from 'react';
import { SetupScreen } from '../react/screens/SetupScreen';
import { BracketScreen } from '../react/screens/BracketScreen';
import { CategoryPickScreen } from '../react/screens/CategoryPickScreen';
import { DuelIntroScreen } from '../react/screens/DuelIntroScreen';
import { DuelScreen } from '../react/screens/DuelScreen';
import { DuelResultScreen } from '../react/screens/DuelResultScreen';
import { ChampionScreen } from '../react/screens/ChampionScreen';
import { CategoryEditorScreen } from '../react/screens/CategoryEditorScreen';
import { HostScreen } from '../react/screens/HostScreen';
import { isHostWindow } from './hostChannel';
import { useCategories } from '../react/hooks/useCategories';
import {
  createTournament,
  tournamentReducer,
  type TournamentEvent,
} from '../tournament/tournamentReducer';
import { saveTournament, loadTournament, clearTournament } from '../tournament/tournamentStore';
import { matchPlayers, roundLabel } from '../engine/bracket/selectors';
import { availableCategories } from '../engine/pickCategory';
import type { Tournament, TournamentDraft } from '../tournament/types';
import type { DuelSummary } from '../engine/duel/types';

function MainApp() {
  const { categories, save, remove } = useCategories();
  const [tournament, setTournament] = useState<Tournament | null>(loadTournament);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (tournament) saveTournament(tournament);
  }, [tournament]);

  const send = useCallback((event: TournamentEvent) => {
    setTournament((prev) => (prev ? tournamentReducer(prev, event) : prev));
  }, []);

  const onFinished = useCallback(
    (summary: DuelSummary) => send({ type: 'FINISH_DUEL', summary }),
    [send],
  );

  const startTournament = (draft: TournamentDraft) => setTournament(createTournament(draft));

  const newTournament = () => {
    clearTournament();
    setTournament(null);
  };

  if (editing) {
    return (
      <CategoryEditorScreen
        categories={categories}
        onSave={save}
        onDelete={remove}
        onDone={() => setEditing(false)}
      />
    );
  }

  if (!tournament) {
    return (
      <SetupScreen
        categories={categories}
        onStart={startTournament}
        onEditCategories={() => setEditing(true)}
      />
    );
  }

  const labelFor = (matchId: string) =>
    roundLabel(tournament.bracket.size, tournament.bracket.matches[matchId]!.round);

  switch (tournament.phase) {
    case 'categoryPick': {
      const match = tournament.bracket.matches[tournament.selectedMatchId!]!;
      const [a, b] = matchPlayers(tournament.bracket, match);
      return (
        <CategoryPickScreen
          roundLabel={labelFor(match.id)}
          playerNames={[a?.name ?? '', b?.name ?? '']}
          categories={availableCategories(
            tournament.enabledCategoryIds,
            categories,
            tournament.usedCategoryIds,
          )}
          onPick={(categoryId) => send({ type: 'DRAW_NEXT_DUEL', categoryId, categories })}
          onBack={() => send({ type: 'ABANDON_DUEL' })}
        />
      );
    }

    case 'duelIntro':
      return (
        <DuelIntroScreen
          setup={tournament.active!.setup}
          roundLabel={labelFor(tournament.active!.matchId)}
          onBegin={() => send({ type: 'BEGIN_DUEL' })}
          onAbandon={() => send({ type: 'ABANDON_DUEL' })}
        />
      );

    case 'duel':
      return (
        <DuelScreen
          key={tournament.active!.setup.duelId}
          setup={tournament.active!.setup}
          seed={tournament.seed}
          roundLabel={labelFor(tournament.active!.matchId)}
          onFinished={onFinished}
          onAbandon={() => send({ type: 'ABANDON_DUEL' })}
        />
      );

    case 'duelResult':
      return (
        <DuelResultScreen
          summary={tournament.lastResult!}
          onContinue={() => send({ type: 'CONTINUE' })}
        />
      );

    case 'champion':
      return <ChampionScreen tournament={tournament} onNewTournament={newTournament} />;

    default:
      return (
        <BracketScreen
          tournament={tournament}
          onPickCategory={(matchId) => send({ type: 'OPEN_CATEGORY_PICK', matchId })}
          onAssignWildcard={(matchId, slot, playerId) =>
            send({ type: 'ASSIGN_WILDCARD', matchId, slot, playerId })
          }
          onNewTournament={newTournament}
        />
      );
  }
}

export function App() {
  // The host window is a read-only view: it must never load or save the tournament.
  return isHostWindow() ? <HostScreen /> : <MainApp />;
}
