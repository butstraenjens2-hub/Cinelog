/**
 * Bundled privacy policy. The same wording is published in PRIVACY.md
 * and docs/privacy.html. This copy works when the device is offline.
 */

export const PRIVACY_EFFECTIVE_DATE = "2026-10-23";

export const PRIVACY_GITHUB_URL =
  "https://github.com/butstraenjens2-hub/Cinelog/blob/main/PRIVACY.md";

export const PRIVACY_ISSUES_URL =
  "https://github.com/butstraenjens2-hub/Cinelog/issues";

/** @type {Record<"en" | "nl", { title: string; intro: string; sections: { heading: string; paragraphs: string[] }[] }>} */
export const PRIVACY_POLICY = {
  en: {
    title: "Privacy policy",
    intro:
      "Effective date: 23 October 2026. This notice explains how the CineLog app handles personal data. It follows the structure of a GDPR privacy notice. The developer is a private individual in Belgium, so the GDPR applies.",
    sections: [
      {
        heading: "Who is responsible",
        paragraphs: [
          "The controller is the private individual who develops CineLog, established in Belgium. There is no company and no published street address. Because the controller is established in the European Union, no representative under Article 27 GDPR is required.",
        ],
      },
      {
        heading: "How to make contact",
        paragraphs: [
          "Questions about this notice or about your data can be sent as a GitHub issue: https://github.com/butstraenjens2-hub/Cinelog/issues",
        ],
      },
      {
        heading: "Information stored on the device",
        paragraphs: [
          "CineLog keeps your library on the device. That includes watchlists, favourites, ratings, watch history, episode progress, household profiles, appearance and notification settings, and recent searches. A local display name and email are stored if you create a local profile. The password typed for a local profile is not saved.",
          "API keys and tokens for Sonarr, Radarr, Jellyfin or Emby, Overseerr or Seerr, Tautulli, Kodi, SIMKL, and Trakt, and the password for an Xtream playlist, are stored in the device keystore. Server addresses, a Trakt or SIMKL client id, and a Kodi username are stored in ordinary app storage.",
          "An IPTV playlist you add is stored on the device, including the playlist address. That address can contain a username and password. CineLog does not ship a playlist of its own.",
          "Suggestions based on your ratings and history are calculated on the device. Reminders are scheduled on the device and are not sent to a push service.",
        ],
      },
      {
        heading: "Services the app contacts",
        paragraphs: [
          "The Movie Database (TMDB) supplies titles, artwork, cast, and where-to-watch data. A build that includes a TMDB key talks to api.themoviedb.org and image.tmdb.org. A build without that key, which is the default configuration in this repository, sends catalogue requests and a startup health check to a proxy the developer runs at https://nexora-api-8xxb.onrender.com, and that proxy asks TMDB. The proxy is not an account system, an advertising network, or an analytics product. A request includes the catalogue path, such as a search or a title id. The proxy log can include the path, the time, the status, and the IP address of the connection. Your watchlist, IPTV playlist, and integration keys are not sent to that proxy.",
          "A trailer uses YouTube’s embedded player. YouTube’s own policy applies when the player loads.",
          "SIMKL (api.simkl.com) and Trakt (api.trakt.tv) are contacted only after you connect an account, and only to read or update the lists, progress, and ratings you chose to sync.",
          "Sonarr, Radarr, Jellyfin, Emby, Overseerr, Seerr, Tautulli, and Kodi are contacted only at the address you enter, with the key or password you stored.",
          "Loading or playing an IPTV playlist contacts the host in that playlist. The built-in Live TV buttons open the official streams or pages of those broadcasters.",
          "On launch the app can ask Expo, at https://u.expo.dev, whether a newer copy of the app bundle is published. That request carries the platform, the runtime version, and the update channel. It does not include your watchlist or server keys.",
          "Firebase Authentication is used only when a build includes Firebase keys. The default configuration in this repository does not include those keys, so sign-in stays on the device. A configured build sends the email and password to Google Firebase to create or check the account. The app does not call Firebase Analytics.",
          "A Letterboxd import reads a CSV file you pick. It is not uploaded. A button can open letterboxd.com in the browser. Where-to-watch buttons open the address you tap.",
        ],
      },
      {
        heading: "Legal basis",
        paragraphs: [
          "Providing the library, a server you connected, or a playlist you added is necessary for the service you asked for (Article 6(1)(b) GDPR).",
          "Connecting an optional account, and allowing notifications, follows your action and the system permission (Article 6(1)(a) GDPR). You can disconnect the account or turn the permission off.",
          "Operational logs on the catalogue proxy, and the update check, serve a legitimate interest in keeping the app available and seeing why a request failed (Article 6(1)(f) GDPR). They are not used to build a profile of you.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "The Android and iOS app does not use cookies. The HTML copy of this policy does not set a cookie.",
        ],
      },
      {
        heading: "Automated decisions",
        paragraphs: [
          "CineLog does not take a decision that produces a legal effect, or a similarly significant effect, based solely on automated processing. On-device suggestions rank public titles from genres you have already watched. You can ignore them, and you can clear the history they use.",
        ],
      },
      {
        heading: "Location",
        paragraphs: [
          "The app does not ask for GPS or a precise location. A country code you pick in Settings is stored on the device and is sent with a TMDB where-to-watch query. Any server you contact, including the catalogue proxy, sees the IP address of the connection. That address is not used as an analytics location.",
        ],
      },
      {
        heading: "Other services and transfers",
        paragraphs: [
          "TMDB, YouTube, SIMKL, Trakt, Firebase, Expo, and the host that serves the catalogue proxy may process a request outside the European Economic Area, under their own terms and the safeguards they offer. Servers you configure are in the place you put them.",
          "Data leaves the device only as described in this notice. It is not sold and it is not handed to advertisers. A service you contacted receives what that request needs. The developer does not keep a database of watchlists.",
        ],
      },
      {
        heading: "How long data is kept",
        paragraphs: [
          "Data on the device stays until you delete it in the app, clear the app’s storage, or uninstall CineLog. The catalogue proxy does not create an account for you. Its operational logs are not a viewing profile.",
        ],
      },
      {
        heading: "Deleting your data",
        paragraphs: [
          "Settings can clear watch history, or erase the local library and sign you out. Clearing the app’s storage, or uninstalling the app, removes the local library, settings, playlist, and the keystore secrets held for CineLog. Disconnecting SIMKL, Trakt, or another service stops future sync from CineLog. Data already stored by that service stays under that service’s policy.",
        ],
      },
      {
        heading: "Children",
        paragraphs: [
          "CineLog is not directed at children under 16. The developer does not knowingly collect personal data from children under 16. If a child under 16 has used a copy of the app, clear the app data or uninstall it.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "The integration secrets named above are placed in the platform keystore. Catalogue calls use HTTPS. A playlist host you enter may be plain HTTP when that host only offers HTTP. No method of storage is perfect.",
        ],
      },
      {
        heading: "Changes",
        paragraphs: [
          "This policy is effective on 23 October 2026. A later change will be published in the repository and in the app, and the date at the top will change with it.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You can ask to access, correct, erase, restrict, or receive a copy of personal data the developer actually holds, and you can object to processing that is based on legitimate interest. You can withdraw a permission by turning it off or by disconnecting a service. The library the developer can point you to is the copy on your device. The developer does not keep a second copy of it.",
          "You can lodge a complaint with the Belgian Data Protection Authority (Gegevensbeschermingsautoriteit / Autorité de protection des données) at https://www.gegevensbeschermingsautoriteit.be, or with the authority where you live. The European Data Protection Board publishes the list of authorities: https://www.edpb.europa.eu/about-edpb/about-edpb/members_en",
        ],
      },
      {
        heading: "Sale of personal data",
        paragraphs: [
          "The developer does not sell personal information and does not share it for cross-context behavioural advertising. CineLog shows no ads. No analytics or crash-reporting SDK is started.",
        ],
      },
    ],
  },
  nl: {
    title: "Privacybeleid",
    intro:
      "Ingangsdatum: 23 oktober 2026. Dit bericht legt uit hoe de app CineLog persoonsgegevens behandelt. Het volgt de opbouw van een GDPR-privacyverklaring. De ontwikkelaar is een privépersoon in België, dus de AVG/GDPR is van toepassing.",
    sections: [
      {
        heading: "Wie is verantwoordelijk",
        paragraphs: [
          "De verwerkingsverantwoordelijke is de privépersoon die CineLog ontwikkelt, gevestigd in België. Er is geen vennootschap en geen gepubliceerd straatadres. Omdat de verantwoordelijke in de Europese Unie is gevestigd, is geen vertegenwoordiger onder artikel 27 AVG nodig.",
        ],
      },
      {
        heading: "Contact",
        paragraphs: [
          "Vragen over dit bericht of over uw gegevens kunnen als GitHub-issue worden gestuurd: https://github.com/butstraenjens2-hub/Cinelog/issues",
        ],
      },
      {
        heading: "Gegevens op het toestel",
        paragraphs: [
          "CineLog bewaart uw bibliotheek op het toestel. Dat omvat kijklijsten, favorieten, scores, kijkgeschiedenis, voortgang per aflevering, huishoudprofielen, weergave- en meldingsinstellingen, en recente zoekopdrachten. Een lokale weergavenaam en e-mail worden bewaard als u een lokaal profiel maakt. Het wachtwoord dat u voor een lokaal profiel typt, wordt niet opgeslagen.",
          "API-sleutels en tokens voor Sonarr, Radarr, Jellyfin of Emby, Overseerr of Seerr, Tautulli, Kodi, SIMKL en Trakt, en het wachtwoord van een Xtream-afspeellijst, staan in de sleutelkluis van het toestel. Serveradressen, een Trakt- of SIMKL-client-id en een Kodi-gebruikersnaam staan in gewone app-opslag.",
          "Een IPTV-afspeellijst die u toevoegt, blijft op het toestel, inclusief het adres van de lijst. Dat adres kan een gebruikersnaam en een wachtwoord bevatten. CineLog levert zelf geen afspeellijst mee.",
          "Suggesties op basis van uw scores en geschiedenis worden op het toestel berekend. Herinneringen worden op het toestel gepland en niet naar een pushdienst gestuurd.",
        ],
      },
      {
        heading: "Diensten die de app contacteert",
        paragraphs: [
          "The Movie Database (TMDB) levert titels, afbeeldingen, cast en waar-te-kijken-gegevens. Een build met een TMDB-sleutel spreekt api.themoviedb.org en image.tmdb.org aan. Een build zonder die sleutel, de standaard in deze repository, stuurt catalogusverzoeken en een health-check bij het opstarten naar een proxy die de ontwikkelaar draait op https://nexora-api-8xxb.onrender.com, en die proxy vraagt TMDB. De proxy is geen accountsysteem, geen advertentienetwerk en geen analyseproduct. Een verzoek bevat het cataloguspad, bijvoorbeeld een zoekopdracht of een titel-id. Het logboek van de proxy kan het pad, het tijdstip, de status en het IP-adres van de verbinding bevatten. Uw kijklijst, IPTV-afspeellijst en integratiesleutels gaan niet naar die proxy.",
          "Een trailer gebruikt de ingesloten speler van YouTube. Het beleid van YouTube geldt zodra de speler laadt.",
          "SIMKL (api.simkl.com) en Trakt (api.trakt.tv) worden alleen gecontacteerd nadat u een account koppelt, en alleen om de lijsten, voortgang en scores te lezen of bij te werken die u koos om te synchroniseren.",
          "Sonarr, Radarr, Jellyfin, Emby, Overseerr, Seerr, Tautulli en Kodi worden alleen gecontacteerd op het adres dat u invult, met de sleutel of het wachtwoord dat u bewaarde.",
          "Een IPTV-afspeellijst laden of afspelen contacteert de host in die lijst. De ingebouwde Live TV-knoppen openen de officiële streams of pagina’s van die omroepen.",
          "Bij het opstarten kan de app aan Expo, op https://u.expo.dev, vragen of een nieuwere bundel van de app is gepubliceerd. Dat verzoek bevat het platform, de runtimeversie en het updatekanaal. Het bevat niet uw kijklijst of serversleutels.",
          "Firebase Authentication wordt alleen gebruikt wanneer een build Firebase-sleutels bevat. De standaardconfiguratie in deze repository bevat die sleutels niet, dus aanmelden blijft op het toestel. Een geconfigureerde build stuurt het e-mailadres en het wachtwoord naar Google Firebase om het account te maken of te controleren. De app roept Firebase Analytics niet aan.",
          "Een Letterboxd-import leest een CSV-bestand dat u kiest. Het wordt niet geüpload. Een knop kan letterboxd.com in de browser openen. Waar-te-kijken-knoppen openen het adres waarop u tikt.",
        ],
      },
      {
        heading: "Rechtsgrond",
        paragraphs: [
          "De bibliotheek, een server die u koppelde, of een afspeellijst die u toevoegde, is nodig voor de dienst die u vroeg (artikel 6, lid 1, b, AVG).",
          "Een optioneel account koppelen, en meldingen toestaan, volgt uw handeling en de systeemtoestemming (artikel 6, lid 1, a, AVG). U kunt het account loskoppelen of de toestemming uitzetten.",
          "Operationele logs op de catalogusproxy, en de updatecontrole, dienen een gerechtvaardigd belang om de app beschikbaar te houden en te zien waarom een verzoek mislukte (artikel 6, lid 1, f, AVG). Ze worden niet gebruikt om een profiel van u op te bouwen.",
        ],
      },
      {
        heading: "Cookies",
        paragraphs: [
          "De Android- en iOS-app gebruikt geen cookies. De HTML-versie van dit beleid plaatst geen cookie.",
        ],
      },
      {
        heading: "Geautomatiseerde besluiten",
        paragraphs: [
          "CineLog neemt geen besluit met een rechtsgevolg, of een vergelijkbaar aanzienlijk gevolg, dat uitsluitend op geautomatiseerde verwerking berust. Suggesties op het toestel rangschikken openbare titels uit genres die u al bekeek. U kunt ze negeren, en u kunt de geschiedenis wissen waarop ze steunen.",
        ],
      },
      {
        heading: "Locatie",
        paragraphs: [
          "De app vraagt geen GPS of precieze locatie. Een landcode die u in Instellingen kiest, blijft op het toestel en gaat mee met een TMDB-vraag over waar te kijken. Elke server die u contacteert, ook de catalogusproxy, ziet het IP-adres van de verbinding. Dat adres wordt niet als analyselocatie gebruikt.",
        ],
      },
      {
        heading: "Andere diensten en doorgifte",
        paragraphs: [
          "TMDB, YouTube, SIMKL, Trakt, Firebase, Expo en de host van de catalogusproxy kunnen een verzoek buiten de Europese Economische Ruimte verwerken, onder hun eigen voorwaarden en de waarborgen die zij bieden. Servers die u instelt, staan waar u ze plaatst.",
          "Gegevens verlaten het toestel alleen zoals dit bericht beschrijft. Ze worden niet verkocht en niet aan adverteerders gegeven. Een dienst die u contacteerde, ontvangt wat dat verzoek nodig heeft. De ontwikkelaar houdt geen databank van kijklijsten bij.",
        ],
      },
      {
        heading: "Bewaartermijn",
        paragraphs: [
          "Gegevens op het toestel blijven staan tot u ze in de app wist, de opslag van de app wist, of CineLog verwijdert. De catalogusproxy maakt geen account voor u aan. De operationele logs zijn geen kijkprofiel.",
        ],
      },
      {
        heading: "Gegevens wissen",
        paragraphs: [
          "In Instellingen kunt u de kijkgeschiedenis wissen, of de lokale bibliotheek wissen en afmelden. De opslag van de app wissen, of de app verwijderen, haalt de lokale bibliotheek, instellingen, afspeellijst en de sleutelkluisgegevens van CineLog weg. SIMKL, Trakt of een andere dienst loskoppelen stopt verdere synchronisatie vanuit CineLog. Gegevens die die dienst al bewaart, vallen onder het beleid van die dienst.",
        ],
      },
      {
        heading: "Kinderen",
        paragraphs: [
          "CineLog is niet gericht op kinderen jonger dan 16 jaar. De ontwikkelaar verzamelt niet bewust persoonsgegevens van kinderen jonger dan 16 jaar. Heeft een kind jonger dan 16 een exemplaar van de app gebruikt, wis dan de appgegevens of verwijder de app.",
        ],
      },
      {
        heading: "Beveiliging",
        paragraphs: [
          "De genoemde integratiegeheimen staan in de sleutelkluis van het platform. Catalogusverzoeken gebruiken HTTPS. Een afspeellijst-host die u invult, kan gewoon HTTP zijn wanneer die host alleen HTTP aanbiedt. Geen opslagmethode is volmaakt.",
        ],
      },
      {
        heading: "Wijzigingen",
        paragraphs: [
          "Dit beleid gaat in op 23 oktober 2026. Een latere wijziging wordt in de repository en in de app gepubliceerd, en de datum bovenaan verandert mee.",
        ],
      },
      {
        heading: "Uw rechten",
        paragraphs: [
          "U kunt vragen om inzage, verbetering, wissing, beperking of een kopie van persoonsgegevens die de ontwikkelaar effectief bijhoudt, en u kunt bezwaar maken tegen verwerking op grond van gerechtvaardigd belang. U kunt een toestemming intrekken door ze uit te zetten of een dienst los te koppelen. De bibliotheek waar de ontwikkelaar u naartoe kan wijzen, is het exemplaar op uw toestel. De ontwikkelaar bewaart daarvan geen tweede kopie.",
          "U kunt een klacht indienen bij de Gegevensbeschermingsautoriteit (Autorité de protection des données) op https://www.gegevensbeschermingsautoriteit.be, of bij de autoriteit van het land waar u woont. Het Europees Comité voor gegevensbescherming publiceert de lijst van autoriteiten: https://www.edpb.europa.eu/about-edpb/about-edpb/members_en",
        ],
      },
      {
        heading: "Verkoop van persoonsgegevens",
        paragraphs: [
          "De ontwikkelaar verkoopt geen persoonsgegevens en deelt ze niet voor gedragsreclame over contexten heen. CineLog toont geen reclame. Er wordt geen analyse- of crashrapportage-SDK gestart.",
        ],
      },
    ],
  },
};
