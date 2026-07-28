import { Card, Layout } from '../../components/Layout';

export function OnlineJoinDisabledScreen({ roomId }: { roomId: string }) {
  const normalizedRoomId = roomId.trim().toUpperCase();

  return <Layout><Card className="join-card">
    <div className="hero">
      <span className="eyebrow">Dołączanie przez internet jest wyłączone</span>
      <h1>Host musi włączyć dołączanie online</h1>
      <p>Ten pokój działa teraz tylko lokalnie. Z przeglądarki nie można jeszcze do niego dołączyć.</p>
    </div>
    <div className="invite-status warning" role="alert">
      <span>!</span>
      <div>
        <strong>Poproś prowadzącego o włączenie gry online</strong>
        <small>Na ekranie „Ustawienia” musi włączyć opcję „Dołączanie przez internet (Peer)”. Następnie odśwież stronę albo zeskanuj kod QR ponownie.</small>
      </div>
    </div>
    {normalizedRoomId ? <p>Oczekujesz na pokój <b>{normalizedRoomId}</b>.</p> : null}
    <p>Osoby korzystające z aplikacji Android w tej samej sieci nadal mogą dołączyć lokalnie.</p>
  </Card></Layout>;
}
