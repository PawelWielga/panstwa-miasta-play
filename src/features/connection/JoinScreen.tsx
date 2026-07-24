import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../../app/AppContext';
import { Card, Layout } from '../../components/Layout';
import { PLAYER_NAME_MAX_LENGTH } from '../../protocol/constants';
import { parseJoinParameters, validateJoinParameters, type JoinParameters } from './joinParams';

const emojis = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐙', '🦄', '🚀', '🌟', '🎲'];
const colors = ['#6d4aff', '#e84472', '#147d92', '#e56b2f', '#2f855a', '#8c5b3d'];

export function JoinScreen({ search = window.location.search }: { search?: string }) {
  const { state, actions } = useApp();
  const parsed = useMemo(() => parseJoinParameters(search), [search]);
  const [parameters, setParameters] = useState<JoinParameters>(parsed.value ?? { roomId: new URLSearchParams(search).get('room') ?? '', hostPeerId: new URLSearchParams(search).get('peer') ?? '', protocolVersion: Number(new URLSearchParams(search).get('protocol') ?? 3) });
  const [name, setName] = useState(state.identity.playerName);
  const [emoji, setEmoji] = useState(state.identity.playerEmoji);
  const [color, setColor] = useState(state.identity.playerColor);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const showTechnical = parsed.value === null;

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const normalizedName = name.trim();
    const nextErrors: Record<string, string> = {};
    if (!normalizedName) nextErrors.name = 'Wpisz nazwę gracza.';
    if (normalizedName.length > PLAYER_NAME_MAX_LENGTH) nextErrors.name = `Nazwa może mieć maksymalnie ${PLAYER_NAME_MAX_LENGTH} znaki.`;
    const parameterErrors = validateJoinParameters(parameters);
    for (const [key, value] of Object.entries(parameterErrors)) if (value) nextErrors[key] = value;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    actions.updateIdentity({ playerName: normalizedName, playerEmoji: emoji, playerColor: color });
    void actions.connect({ ...parameters, roomId: parameters.roomId.trim().toUpperCase(), hostPeerId: parameters.hostPeerId.trim() });
  };

  return <Layout><Card className="join-card">
    <div className="hero"><span className="eyebrow">Dołącz do rozgrywki</span><h1>Gotowy na rundę?</h1><p>Telefon prowadzącego pozostaje hostem gry. Ty wpisujesz odpowiedzi tutaj.</p></div>
    {parsed.fromInvitation && parsed.value ? <div className="invite-status success"><span>✓</span><div><strong>Zaproszenie jest poprawne</strong><small>Pokój <b>{parsed.value.roomId}</b></small></div></div> : <div className="invite-status warning"><span>!</span><div><strong>Uzupełnij dane pokoju</strong><small>Najwygodniej otworzyć link lub zeskanować QR z telefonu prowadzącego.</small></div></div>}
    <form onSubmit={submit} noValidate>
      <label>Nazwa gracza<input autoFocus name="playerName" autoComplete="nickname" maxLength={PLAYER_NAME_MAX_LENGTH} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} /></label>
      {errors.name ? <p className="field-error">{errors.name}</p> : null}
      <fieldset><legend>Wybierz emoji</legend><div className="choice-grid emoji-grid">{emojis.map((item) => <button type="button" className={emoji === item ? 'choice selected' : 'choice'} aria-pressed={emoji === item} key={item} onClick={() => setEmoji(item)}>{item}</button>)}</div></fieldset>
      <fieldset><legend>Wybierz kolor</legend><div className="choice-grid color-grid">{colors.map((item) => <button type="button" className={color === item ? 'color-choice selected' : 'color-choice'} aria-label={`Kolor ${item}`} aria-pressed={color === item} key={item} style={{ backgroundColor: item }} onClick={() => setColor(item)} />)}</div></fieldset>
      {showTechnical ? <details open className="technical-fields"><summary>Dane połączenia</summary>
        <label>Kod pokoju<input value={parameters.roomId} maxLength={6} autoCapitalize="characters" onChange={(event) => setParameters({ ...parameters, roomId: event.target.value.toUpperCase() })} /></label>{errors.room ? <p className="field-error">{errors.room}</p> : null}
        <label>Identyfikator hosta PeerJS<input value={parameters.hostPeerId} onChange={(event) => setParameters({ ...parameters, hostPeerId: event.target.value })} /></label>{errors.peer ? <p className="field-error">{errors.peer}</p> : null}
        <label>Wersja protokołu<input type="number" min="1" step="1" value={parameters.protocolVersion || ''} onChange={(event) => setParameters({ ...parameters, protocolVersion: Number(event.target.value) })} /></label>{errors.protocol ? <p className="field-error">{errors.protocol}</p> : null}
      </details> : null}
      <button className="button button-primary button-large" type="submit">Dołącz do gry</button>
    </form>
    <p className="privacy-note">Połączenie jest bezpośrednie P2P. Publiczny PeerJS Cloud służy tylko do zestawienia połączenia.</p>
  </Card></Layout>;
}
