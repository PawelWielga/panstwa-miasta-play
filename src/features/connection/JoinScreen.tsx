import { useMemo, useState, type SyntheticEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import { PLAYER_NAME_MAX_LENGTH } from '../../protocol/constants';
import { OnlineJoinDisabledScreen } from './OnlineJoinDisabledScreen';
import {
  normalizeOnlineJoinCode,
  parseJoinParameters,
  parseOnlineJoinCode,
  sanitizedJoinInvitationPath,
  validateOnlineJoinCode,
  type JoinParameterErrorKey,
} from './joinParams';

type FormErrorKey = 'name' | JoinParameterErrorKey;

export function JoinScreen({ search }: { search?: string }) {
  const { state, actions } = useApp();
  const usesWindowLocation = search === undefined;
  const effectiveSearch = search ?? window.location.search;
  const searchParams = useMemo(() => new URLSearchParams(effectiveSearch), [effectiveSearch]);
  const parsed = useMemo(() => parseJoinParameters(effectiveSearch), [effectiveSearch]);
  const rawRoomId = searchParams.get('room') ?? '';
  const rawOnlineJoinCode = searchParams.get('code') ?? '';
  const onlineJoinDisabled = searchParams.get('online')?.trim().toLowerCase() === 'disabled';
  const [onlineJoinCode, setOnlineJoinCode] = useState(parsed.value?.onlineJoinCode ?? normalizeOnlineJoinCode(rawOnlineJoinCode));
  const [name, setName] = useState(state.identity.playerName);
  const [errors, setErrors] = useState<Partial<Record<FormErrorKey, string>>>({});

  if (onlineJoinDisabled) return <OnlineJoinDisabledScreen roomId={rawRoomId} />;

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalizedName = name.trim();
    const nextErrors: Partial<Record<FormErrorKey, string>> = {};
    if (!normalizedName) nextErrors.name = 'Wpisz nick gracza.';
    if (normalizedName.length > PLAYER_NAME_MAX_LENGTH) nextErrors.name = `Nick może mieć maksymalnie ${String(PLAYER_NAME_MAX_LENGTH)} znaki.`;
    Object.assign(nextErrors, validateOnlineJoinCode(onlineJoinCode));
    if (parsed.errors.protocol) nextErrors.protocol = parsed.errors.protocol;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const credentials = parseOnlineJoinCode(onlineJoinCode);
    if (usesWindowLocation) {
      window.history.replaceState(
        window.history.state,
        '',
        sanitizedJoinInvitationPath(window.location.href),
      );
    }
    actions.updateIdentity({
      playerName: normalizedName,
      playerEmoji: state.identity.playerEmoji,
      playerColor: state.identity.playerColor,
    });
    void actions.connect(credentials);
  };

  const protocolError = errors.protocol ?? parsed.errors.protocol;
  return <Layout><Card className="join-card">
    <div className="hero"><span className="eyebrow">Dołącz do rozgrywki</span><h1>Gotowy na rundę?</h1><p>Wpisz swój nick i kod dołączenia wyświetlony przez prowadzącego.</p></div>
    {parsed.fromInvitation && parsed.value ? <div className="invite-status success"><span>✓</span><div><strong>Zaproszenie jest poprawne</strong><small>Pokój <b>{parsed.value.roomId}</b></small></div></div> : null}
    {protocolError ? <div className="invite-status warning" role="alert"><span>!</span><div><strong>Nie można użyć tego linku</strong><small>{protocolError}</small></div></div> : null}
    <form onSubmit={submit} noValidate>
      <label>Twój nick<input autoFocus name="playerName" autoComplete="nickname" maxLength={PLAYER_NAME_MAX_LENGTH} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} /></label>
      {errors.name ? <p className="field-error">{errors.name}</p> : null}
      <label>Kod dołączenia<input name="onlineJoinCode" value={onlineJoinCode} maxLength={64} autoCapitalize="characters" autoComplete="off" onChange={(event) => setOnlineJoinCode(event.target.value.toUpperCase())} aria-invalid={Boolean(errors.code)} /></label>
      {(errors.code ?? parsed.errors.code) ? <p className="field-error">{errors.code ?? parsed.errors.code}</p> : null}
      <button className="button button-primary button-large" type="submit">Dołącz do gry</button>
    </form>
  </Card></Layout>;
}
