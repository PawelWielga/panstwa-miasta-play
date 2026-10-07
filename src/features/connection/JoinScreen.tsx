import { useMemo, useState, type SyntheticEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import { PLAYER_NAME_MAX_LENGTH } from '../../protocol/constants';
import {
  readLatestUnfinishedMultiplayerSession,
  removeUnfinishedMultiplayerSession,
} from '../../storage/unfinishedMultiplayerSessionStorage';
import { OnlineJoinDisabledScreen } from './OnlineJoinDisabledScreen';
import { translateLegacyMessage, useI18n, type LanguagePreference } from '../../i18n/appLanguage';
import {
  normalizeOnlineJoinCode,
  normalizeShortOnlineJoinCodeInput,
  parseJoinParameters,
  parseOnlineJoinCode,
  sanitizedJoinInvitationPath,
  validateOnlineJoinCode,
  type JoinParameterErrorKey,
} from './joinParams';

type FormErrorKey = 'name' | JoinParameterErrorKey;

export function JoinScreen({ search }: { search?: string }) {
  const { state, actions } = useApp();
  const { language, preference, setPreference, t } = useI18n();
  const usesWindowLocation = search === undefined;
  const effectiveSearch = search ?? window.location.search;
  const searchParams = useMemo(() => new URLSearchParams(effectiveSearch), [effectiveSearch]);
  const parsed = useMemo(() => parseJoinParameters(effectiveSearch), [effectiveSearch]);
  const rawRoomId = searchParams.get('room') ?? '';
  const rawOnlineJoinCode = searchParams.get('code') ?? '';
  const onlineJoinDisabled = searchParams.get('online')?.trim().toLowerCase() === 'disabled';
  const [onlineJoinCode, setOnlineJoinCode] = useState(
    parsed.value?.roomId ?? normalizeOnlineJoinCode(rawOnlineJoinCode),
  );
  const [joinCodeDirty, setJoinCodeDirty] = useState(false);
  const [name, setName] = useState(state.identity.playerName);
  const [errors, setErrors] = useState<Partial<Record<FormErrorKey, string>>>({});
  const [unfinishedSession, setUnfinishedSession] = useState(() => readLatestUnfinishedMultiplayerSession());

  if (onlineJoinDisabled) return <OnlineJoinDisabledScreen roomId={rawRoomId} />;

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const normalizedName = name.trim();
    const nextErrors: Partial<Record<FormErrorKey, string>> = {};
    if (!normalizedName) nextErrors.name = t('Wpisz nick gracza.', 'Enter your nickname.');
    if (normalizedName.length > PLAYER_NAME_MAX_LENGTH) nextErrors.name = t(`Nick może mieć maksymalnie ${String(PLAYER_NAME_MAX_LENGTH)} znaki.`, `Nickname can contain at most ${String(PLAYER_NAME_MAX_LENGTH)} characters.`);
    if (joinCodeDirty || !parsed.value) {
      Object.assign(nextErrors, validateOnlineJoinCode(onlineJoinCode));
    }
    if (parsed.errors.protocol) nextErrors.protocol = parsed.errors.protocol;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const credentials = !joinCodeDirty && parsed.value
      ? parsed.value
      : parseOnlineJoinCode(onlineJoinCode);
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

  const resumeStoredSession = (): void => {
    if (!unfinishedSession) return;
    void actions.connect(unfinishedSession.target, unfinishedSession);
  };

  const leaveStoredSession = (): void => {
    if (!unfinishedSession) return;
    removeUnfinishedMultiplayerSession(unfinishedSession.target, unfinishedSession.playerId);
    setUnfinishedSession(null);
  };

  const protocolError = errors.protocol ?? parsed.errors.protocol;
  const localizedProtocolError = protocolError ? translateLegacyMessage(protocolError, language) : null;
  const localizedCodeError = errors.code ?? parsed.errors.code
    ? translateLegacyMessage((errors.code ?? parsed.errors.code)!, language)
    : null;
  const showResumeOffer = unfinishedSession !== null && !parsed.fromInvitation;
  return <Layout><Card className="join-card">
    <div className="hero"><span className="eyebrow">{t('Dołącz do rozgrywki', 'Join the game')}</span><h1>{t('Gotowy na rundę?', 'Ready for a round?')}</h1><p>{t('Wpisz swój nick i 6-znakowy kod pokoju wyświetlony przez prowadzącego.', 'Enter your nickname and the 6-character room code shown by the host.')}</p></div>
    <label>{t('Język aplikacji', 'App language')}
      <select value={preference} onChange={(event) => setPreference(event.target.value as LanguagePreference)}>
        <option value="system">{t('Systemowy', 'System')}</option>
        <option value="pl">Polski</option>
        <option value="en">English</option>
      </select>
    </label>
    {showResumeOffer ? <>
      <div className="invite-status success"><span>↻</span><div><strong>{t('Masz niedokończoną grę', 'You have an unfinished game')}</strong><small>{t('Pokój', 'Room')} <b>{unfinishedSession.target.roomId}</b></small></div></div>
      <div className="button-row">
        <button className="button button-primary" type="button" onClick={resumeStoredSession}>{t('Wróć do gry', 'Resume game')}</button>
        <button className="button button-secondary" type="button" onClick={leaveStoredSession}>{t('Opuść', 'Leave')}</button>
      </div>
    </> : null}
    {parsed.fromInvitation && parsed.value ? <div className="invite-status success"><span>✓</span><div><strong>{t('Zaproszenie jest poprawne', 'Invitation is valid')}</strong><small>{t('Pokój', 'Room')} <b>{parsed.value.roomId}</b></small></div></div> : null}
    {localizedProtocolError ? <div className="invite-status warning" role="alert"><span>!</span><div><strong>{t('Nie można użyć tego linku', 'This link cannot be used')}</strong><small>{localizedProtocolError}</small></div></div> : null}
    <form onSubmit={submit} noValidate>
      <label>{t('Twój nick', 'Your nickname')}<input autoFocus name="playerName" autoComplete="nickname" maxLength={PLAYER_NAME_MAX_LENGTH} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} /></label>
      {errors.name ? <p className="field-error">{errors.name}</p> : null}
      <label>{t('Kod pokoju (6 znaków)', 'Room code (6 characters)')}<input name="onlineJoinCode" value={onlineJoinCode} placeholder="ABC234" autoCapitalize="characters" autoComplete="off" spellCheck={false} onChange={(event) => {
        setJoinCodeDirty(true);
        setOnlineJoinCode(normalizeShortOnlineJoinCodeInput(event.target.value).slice(0, 6));
      }} aria-invalid={Boolean(errors.code)} /></label>
      {localizedCodeError ? <p className="field-error">{localizedCodeError}</p> : null}
      <button className="button button-primary button-large" type="submit">{t('Dołącz do gry', 'Join game')}</button>
    </form>
  </Card></Layout>;
}
