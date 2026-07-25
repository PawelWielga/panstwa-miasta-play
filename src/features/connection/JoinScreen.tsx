import { useMemo, useState, type SyntheticEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import { PLAYER_NAME_MAX_LENGTH } from '../../protocol/constants';
import {
  normalizeRoomId,
  parseJoinParameters,
  validateJoinParameters,
  type JoinParameterErrorKey,
  type JoinParameters,
} from './joinParams';

type FormErrorKey = 'name' | JoinParameterErrorKey;

export function JoinScreen({ search = window.location.search }: { search?: string }) {
  const { state, actions } = useApp();
  const parsed = useMemo(() => parseJoinParameters(search), [search]);
  const rawRoomId = new URLSearchParams(search).get('room') ?? '';
  const [parameters, setParameters] = useState<JoinParameters>(parsed.value ?? { roomId: rawRoomId.trim().toUpperCase() });
  const [name, setName] = useState(state.identity.playerName);
  const [errors, setErrors] = useState<Partial<Record<FormErrorKey, string>>>({});

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalizedName = name.trim();
    const nextErrors: Partial<Record<FormErrorKey, string>> = {};
    if (!normalizedName) nextErrors.name = 'Wpisz nick gracza.';
    if (normalizedName.length > PLAYER_NAME_MAX_LENGTH) nextErrors.name = `Nick może mieć maksymalnie ${String(PLAYER_NAME_MAX_LENGTH)} znaki.`;
    Object.assign(nextErrors, validateJoinParameters(parameters));
    if (parsed.errors.protocol) nextErrors.protocol = parsed.errors.protocol;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const roomId = normalizeRoomId(parameters.roomId);
    actions.updateIdentity({
      playerName: normalizedName,
      playerEmoji: state.identity.playerEmoji,
      playerColor: state.identity.playerColor,
    });
    void actions.connect({ roomId });
  };

  const protocolError = errors.protocol ?? parsed.errors.protocol;

  return <Layout><Card className="join-card">
    <div className="hero"><span className="eyebrow">Dołącz do rozgrywki</span><h1>Gotowy na rundę?</h1><p>Wpisz swój nick i kod pokoju wyświetlony przez prowadzącego.</p></div>
    {parsed.fromInvitation && parsed.value ? <div className="invite-status success"><span>✓</span><div><strong>Zaproszenie jest poprawne</strong><small>Pokój <b>{parsed.value.roomId}</b></small></div></div> : null}
    {protocolError ? <div className="invite-status warning" role="alert"><span>!</span><div><strong>Nie można użyć tego linku</strong><small>{protocolError}</small></div></div> : null}
    <form onSubmit={submit} noValidate>
      <label>Twój nick<input autoFocus name="playerName" autoComplete="nickname" maxLength={PLAYER_NAME_MAX_LENGTH} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} /></label>
      {errors.name ? <p className="field-error">{errors.name}</p> : null}
      <label>Kod pokoju<input name="roomId" value={parameters.roomId} maxLength={6} autoCapitalize="characters" autoComplete="off" onChange={(event) => setParameters({ roomId: event.target.value.toUpperCase() })} aria-invalid={Boolean(errors.room)} /></label>
      {errors.room ? <p className="field-error">{errors.room}</p> : null}
      <button className="button button-primary button-large" type="submit">Dołącz do gry</button>
    </form>
  </Card></Layout>;
}
