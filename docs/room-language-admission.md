# Room language admission

The current web interface is Polish. Every `player:hello` and `client:rejoin`
declares `appLanguageCode: "pl"`, including process resume and reconnect.
This value describes the interface, never a host snapshot or browser locale.

Android hosts implementing panstwa-miasta #583 validate the declaration before
publishing the player list. Missing, unsupported or different declarations are
rejected with `game:error`, code `language_mismatch`, and `gameLanguageCode`
(`pl` or `en`). The bridge forwards this game message unchanged. This is a
terminal admission failure: close the connection and do not reconnect or fall
back to another transport automatically.

Polish web clients can join Polish rooms. English rooms require an English
interface, which the web client does not yet provide. Older web builds without
the declaration are rejected even for Polish rooms. Deploy the updated web
client before distributing hosts that enforce the admission policy. Existing
transport-v4 authentication vectors and snapshot compatibility are unchanged.
