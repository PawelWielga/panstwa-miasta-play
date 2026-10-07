import { Card, Layout } from '../../components/Layout';
import { useI18n } from '../../i18n/appLanguage';

export function OnlineJoinDisabledScreen({ roomId }: { roomId: string }) {
  const { t } = useI18n();
  const normalizedRoomId = roomId.trim().toUpperCase();

  return <Layout><Card className="join-card">
    <div className="hero">
      <span className="eyebrow">{t('Dołączanie przez internet jest wyłączone', 'Internet joining is disabled')}</span>
      <h1>{t('Host musi włączyć dołączanie online', 'The host must enable online joining')}</h1>
      <p>{t('Ten pokój działa teraz tylko lokalnie. Z przeglądarki nie można jeszcze do niego dołączyć.', 'This room is local-only right now. You cannot join it from a browser yet.')}</p>
    </div>
    <div className="invite-status warning" role="alert">
      <span>!</span>
      <div>
        <strong>{t('Poproś prowadzącego o włączenie gry online', 'Ask the host to enable online play')}</strong>
        <small>{t('Na ekranie „Ustawienia” musi włączyć opcję „Dołączanie przez internet (Peer)”. Następnie odśwież stronę albo zeskanuj kod QR ponownie.', 'In Settings, the host must enable “Join via internet (Peer)”. Then refresh the page or scan the QR code again.')}</small>
      </div>
    </div>
    {normalizedRoomId ? <p>{t('Oczekujesz na pokój', 'Waiting for room')} <b>{normalizedRoomId}</b>.</p> : null}
    <p>{t('Osoby korzystające z aplikacji Android w tej samej sieci nadal mogą dołączyć lokalnie.', 'People using the Android app on the same network can still join locally.')}</p>
  </Card></Layout>;
}
