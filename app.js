// --- Konfiguracja Firebase ---
// Te zmienne zostaną automatycznie wstrzyknięte przez środowisko
let db;
let auth;
let userId;

// Te zmienne są dostarczane przez środowisko
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Funkcja do inicjalizacji Firebase
async function initializeFirebase() {
    // Ustawia poziom logowania Firebase dla debugowania
    firebase.setLogLevel('Debug');

    if (firebaseConfig.apiKey) {
        try {
            const app = firebase.initializeApp(firebaseConfig);
            db = firebase.firestore(app);
            auth = firebase.auth(app);

            // Zaloguj użytkownika
            if (initialAuthToken) {
                await auth.signInWithCustomToken(initialAuthToken);
                console.log("Zalogowano z tokenem.");
            } else {
                await auth.signInAnonymously();
                console.log("Zalogowano anonimowo.");
            }

            userId = auth.currentUser.uid;
            console.log("Firebase zainicjowane, użytkownik zalogowany:", userId);

            // Po zalogowaniu, załaduj dane użytkownika
            // Ta funkcja zdecyduje, czy pokazać ekran powitalny, czy od razu aplikację
            await loadUserData(); 

        } catch (e) {
            console.error("Błąd inicjalizacji Firebase:", e);
            // W razie błędu, uruchom aplikację w trybie offline (bez zapisu)
            app.init(false); // false = tryb offline
        }
    } else {
        console.warn("Konfiguracja Firebase nie jest dostępna. Aplikacja będzie działać w trybie offline.");
        // Uruchom aplikację w trybie offline (bez bazy danych)
        app.init(false); // false = tryb offline
    }
}

// Funkcja do ładowania danych użytkownika z Firestore
async function loadUserData() {
    if (!db || !userId) {
        console.warn("Baza danych lub userId niedostępne, start w trybie offline.");
        app.init(false);
        return;
    }

    try {
        // Ścieżka do dokumentu: /artifacts/{appId}/users/{userId}/app_data/main
        const userDocRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('app_data').doc('main');

        const doc = await userDocRef.get();

        if (doc.exists) {
            console.log("Załadowano dane użytkownika z Firestore:", doc.data());
            const userData = doc.data();
            
            // Mamy dane! Zaktualizuj lokalny stan (state)
            state.userName = userData.userName || '';
            state.auditHistory = userData.auditHistory || [];
            state.plan10Days = userData.plan10Days || [];
            state.completedExercises = userData.completedExercises || [];
            state.readArticles = userData.readArticles || [];
            state.badges = userData.badges || state.badges; // Zachowaj domyślne, jeśli nie ma w bazie
            state.points = userData.points || 0;
            state.streak = userData.streak || 0;
            state.lastActivityDate = userData.lastActivityDate || null;
            state.quizCompleted = userData.quizCompleted || false;
            state.quizBonusAwarded = userData.quizBonusAwarded || false;

            // Sprawdź, czy stan odznak jest zsynchronizowany (na wypadek dodania nowych)
            state.badges.forEach(badge => {
                const savedBadge = userData.badges?.find(b => b.id === badge.id);
                if (savedBadge) {
                    badge.unlocked = savedBadge.unlocked;
                }
            });

            // Uruchom aplikację z załadowanymi danymi
            app.init(true); // true = dane załadowane

        } else {
            // Brak danych. To pierwsza wizyta.
            console.log("Brak danych użytkownika w Firestore. Pokazuję ekran powitalny.");
            app.init(false); // false = brak danych, pokaż ekran powitalny
        }
    } catch (e) {
        console.error("Błąd odczytu danych z Firestore:", e);
        app.init(false); // W razie błędu startuj w trybie offline
    }
}
// --- Koniec konfiguracji Firebase ---


// Application state
const state = {
  userName: '',
  currentSection: 'dashboard',
  auditHistory: [],
// ... (reszta obiektu state bez zmian) ...
  currentAudit: null,
  plan10Days: [],
  completedExercises: [],
  readArticles: [],
  unlockedBadges: [],
  points: 0,
  streak: 0,
  lastActivityDate: null,
  sidebarOpen: false,
  quizCompleted: false,
  quizBonusAwarded: false,
  
  // Audit sections data
  auditSections: [
    {
      id: 1,
      title: "Krzesło i ustawienie ciała",
      icon: "fas fa-chair",
      weight: 25,
      healthRisk: "krzeslo",
      questions: [
        { id: "k1", text: "Stopy w pełni oparte o podłogę; w razie potrzeby podnóżek/podstawka", checked: false, weight: 6.25, healthRisk: "krzeslo" },
        { id: "k2", text: "Uda równolegle do podłogi; kąt w kolanach ok. 90°", checked: false, weight: 6.25, healthRisk: "krzeslo" },
        { id: "k3", text: "Oparcie z wyczuwalnym podparciem lędźwi", checked: false, weight: 6.25, healthRisk: "krzeslo" },
        { id: "k4", text: "Podłokietniki na poziomie blatu; barki rozluźnione; nadgarstki w osi", checked: false, weight: 6.25, healthRisk: "krzeslo" }
      ]
    },
    {
      id: 2,
      title: "Monitor",
      icon: "fas fa-desktop",
      weight: 20,
      healthRisk: "monitor",
      questions: [
        { id: "m1", text: "Górna krawędź ekranu na wysokości oczu (lub nieco niżej), odległość 50–70 cm", checked: false, weight: 6.67, healthRisk: "monitor" },
        { id: "m2", text: "Ekran lekko odchylony (10–20°) i ustawiony na wprost", checked: false, weight: 6.67, healthRisk: "monitor" },
        { id: "m3", text: "Źródło światła dziennego pada z boku (bez olśnień i odbić)", checked: false, weight: 6.66, healthRisk: "monitor" }
      ]
    },
    {
      id: 3,
      title: "Klawiatura i mysz",
      icon: "fas fa-keyboard",
      weight: 15,
      healthRisk: "klawiatura_mysz",
      questions: [
        { id: "km1", text: "Klawiatura na wysokości łokci; nadgarstki prosto", checked: false, weight: 7.5, healthRisk: "klawiatura_mysz" },
        { id: "km2", text: "Mysz blisko klawiatury, na tej samej wysokości", checked: false, weight: 7.5, healthRisk: "klawiatura_mysz" }
      ]
    },
    {
      id: 4,
      title: "Postawa ciała",
      icon: "fas fa-user",
      weight: 10,
      healthRisk: "postawa",
      questions: [
        { id: "p1", text: "Plecy prosto; barki rozluźnione", checked: false, weight: 5, healthRisk: "postawa" },
        { id: "p2", text: "Głowa w naturalnej pozycji (nie wysunięta do przodu)", checked: false, weight: 5, healthRisk: "postawa" }
      ]
    },
    {
      id: 5,
      title: "Praca z dwoma monitorami",
      icon: "fas fa-tv",
      weight: 10,
      healthRisk: "2monitory",
      hasMode: true,
      mode: "na",
      questions: [],
      symmetricQuestions: [
        { id: "2m_s1", text: "Krawędzie monitorów stykają się na środku pola widzenia", checked: false, weight: 2.5, healthRisk: "2monitory" },
        { id: "2m_s2", text: "Ta sama wysokość; górna krawędź na wysokości wzroku lub trochę poniżej", checked: false, weight: 2.5, healthRisk: "2monitory" },
        { id: "2m_s3", text: "Nachylenie 10–20° i lekko do środka (jak skrzydła książki)", checked: false, weight: 2.5, healthRisk: "2monitory" },
        { id: "2m_s4", text: "Krzesło ustawione pośrodku między monitorami", checked: false, weight: 2.5, healthRisk: "2monitory" }
      ],
      mixedQuestions: [
        { id: "2m_m1", text: "Główny monitor ustawiony na wprost", checked: false, weight: 3.34, healthRisk: "2monitory" },
        { id: "2m_m2", text: "Pomocniczy z boku, pod kątem; bez skręcania tułowia", checked: false, weight: 3.33, healthRisk: "2monitory" },
        { id: "2m_m3", text: "Zmieniasz stronę monitora pomocniczego co kilka dni", checked: false, weight: 3.33, healthRisk: "2monitory" }
      ]
    },
    {
      id: 6,
      title: "Praca z laptopem",
      icon: "fas fa-laptop",
      weight: 10,
      healthRisk: "laptop",
      hasApplies: true,
      applies: false,
      questions: [
        { id: "l1", text: "Używam podstawki pod laptopa oraz zewnętrznej klawiatury i myszy", checked: false, weight: 5, healthRisk: "laptop" },
        { id: "l2", text: "Otwory wentylacyjne laptopa nie są zasłonięte", checked: false, weight: 5, healthRisk: "laptop" }
      ]
    },
    {
      id: 7,
      title: "Mikroprzerwy i pro-tipy",
      icon: "fas fa-clock",
      weight: 10,
      healthRisk: "mikroprzerwy",
      questions: [
        { id: "mp1", text: "Krótkie, aktywne przerwy co 30–40 minut", checked: false, weight: 3.34, healthRisk: "mikroprzerwy" },
        { id: "mp2", text: "Kosz na śmieci ustawiony dalej od biurka (zachęca do wstania)", checked: false, weight: 3.33, healthRisk: "mikroprzerwy" },
        { id: "mp3", text: "Podczas rozmów tel. bez komputera — wstaję i robię krótki spacer (walk-and-talk)", checked: false, weight: 3.33, healthRisk: "mikroprzerwy" }
      ]
    }
  ],
  
  // Health consequences mapping
  healthConsequences: {
// ... (reszta obiektu state bez zmian) ...
    krzeslo: {
      name: "Problemy z krzesłem i wysokością",
      urgency: "high",
      icon: "fas fa-chair",
      color: "var(--color-orange-500)",
      effects: [
        "Bóle pleców i kręgosłupa (72% pracowników)",
        "Żylaki i obrzęki nóg (20%)",
        "Ograniczony przepływ krwi",
        "Chroniczne zapalenie stawów"
      ],
      actionItems: [
        "Wymień/wyreguluj krzesło",
        "Dodaj podnóżek",
        "Ćwiczenie: Rozciąganie pleców"
      ]
    },
    monitor: {
      name: "Problemy z monitorem",
      urgency: "high",
      icon: "fas fa-desktop",
      color: "var(--color-orange-500)",
      effects: [
        "Bóle karku i szyi (51% pracowników)",
        "Zaburzenia wzroku (60%)",
        "Bóle głowy i migreny (47%)",
        "Zmęczenie oczu"
      ],
      actionItems: [
        "Podnieś monitor na podstawkę",
        "Dostosuj oświetlenie",
        "Ćwiczenie: Palming i ruchy oczu"
      ]
    },
    klawiatura_mysz: {
      name: "Problemy z klawiaturą i myszą",
      urgency: "high",
      icon: "fas fa-keyboard",
      color: "var(--color-orange-500)",
      effects: [
        "Zespół cieśni nadgarstka (15% pracowników)",
        "Bóle ramion i przedramienia",
        "Zapalenie ścięgien",
        "Chroniczny ból nadgarstka"
      ],
      actionItems: [
        "Przysuń mysz do klawiatury",
        "Dodaj podpórkę pod nadgarstki",
        "Ćwiczenie: Rozciąganie nadgarstków"
      ]
    },
    postawa: {
      name: "Problemy z postawą ciała",
      urgency: "high",
      icon: "fas fa-user",
      color: "var(--color-orange-500)",
      effects: [
        "Bóle szyi i karku (51%)",
        "Chroniczne napięcie mięśni",
        "Chroniczne migreny",
        "Skolioza i zaburzenia kręgosłupa"
      ],
      actionItems: [
        "Pamiętaj o naturalnej pozycji głowy",
        "Rozluźniaj barki regularnie",
        "Ćwiczenie: Rotacja szyi i ramion"
      ]
    },
    "2monitory": {
      name: "Asymetryczne ustawienie monitorów",
      urgency: "medium",
      icon: "fas fa-tv",
      color: "var(--color-yellow-500)",
      effects: [
        "Bóle szyi i pleców",
        "Asymetryczne obciążenie mięśni",
        "Skolioza (krzywe boki)",
        "Chroniczne bóle jednostronne"
      ],
      actionItems: [
        "Wyrównaj wysokość monitorów",
        "Ustaw monitory symetrycznie",
        "Ćwiczenie: Rotacja ramion"
      ]
    },
    laptop: {
      name: "Brak właściwego setupu laptopa",
      urgency: "critical",
      icon: "fas fa-laptop",
      color: "var(--color-red-500)",
      effects: [
        "Poważne bóle szyi i pleców",
        "Zespół cieśni nadgarstka (natychmiast)",
        "Chroniczne problemy ze wzrokiem",
        "Długoterminowe uszkodzenia zdrowotne"
      ],
      actionItems: [
        "NATYCHMIAST: Kup podstawkę pod laptopa",
        "Podłącz zewnętrzną klawiaturę i mysz",
        "To jest PRIORYTET!"
      ]
    },
    mikroprzerwy: {
      name: "Brak przerw i ruchu",
      urgency: "critical",
      icon: "fas fa-clock",
      color: "var(--color-red-500)",
      effects: [
        "Stres chroniczny (81% pracowników)",
        "Zwiększone ryzyko chorób serca (30%)",
        "Zmęczenie i depresja (45%)",
        "Zaburzenia snu (20%)"
      ],
      actionItems: [
        "Ustaw timer na co 30 minut",
        "Rób krótkie spacery",
        "Wykonuj ćwiczenia rozluźniające"
      ]
    }
  },
  
  // Plan 10-dniowy data
  challenges: [
// ... (reszta obiektu state bez zmian) ...
    { day: 1, dayOfWeek: "Dzień 1", title: "Zacznij od audytu", task: "Wykonaj pełny audyt ergonomii - otrzymasz spersonalizowany plan działań", type: "audit", completed: false, completedDate: null },
    { day: 2, dayOfWeek: "Dzień 2", title: "Regulacja wysokości", task: "Dostosuj wysokość krzesła - stopy na podłodze, kolana pod 90°", type: "action", completed: false, completedDate: null },
    { day: 3, dayOfWeek: "Dzień 3", title: "Pozycja monitora", task: "Podnieś monitor - górna krawędź ekranu na wysokości oczu", type: "action", completed: false, completedDate: null },
    { day: 4, dayOfWeek: "Dzień 4", title: "Pierwsze ćwiczenia", task: "Wykonaj zestaw ćwiczeń na szyję i ramiona - 10 minut", type: "exercise", completed: false, completedDate: null },
    { day: 5, dayOfWeek: "Dzień 5", title: "Edukacja - połowa tygodnia", task: "Przeczytaj artykuł: Dlaczego ergonomia ma znaczenie dla zdrowia", type: "education", completed: false, completedDate: null },
    { day: 6, dayOfWeek: "Dzień 6", title: "Pozycja klawiatury i myszy", task: "Dostosuj wysokość - klawiatura na łokciach, mysz blisko klawiatury", type: "action", completed: false, completedDate: null },
    { day: 7, dayOfWeek: "Dzień 7", title: "Ćwiczenia na plecy", task: "Wykonaj 10-minutowy set rozciągający na plecy", type: "exercise", completed: false, completedDate: null },
    { day: 8, dayOfWeek: "Dzień 8", title: "Mikroprzerwy - habit builder", task: "Ustaw timer - co godzinę 5-minutowa przerwa z ćwiczeniami", type: "habit", completed: false, completedDate: null },
    { day: 9, dayOfWeek: "Dzień 9", title: "Finalna edukacja", task: "Przeczytaj: Jak utrzymać dobre nawyki ergonomiczne", type: "education", completed: false, completedDate: null },
    { day: 10, dayOfWeek: "Dzień 10", title: "Re-audyt i podsumowanie", task: "Wykonaj ponownie audyt ergonomii - porównaj wyniki! 🎉", type: "audit", completed: false, completedDate: null }
  ],
  
  // Exercises data
  exercises: {
// ... (reszta obiektu state bez zmian) ...
    neckShoulders: {
      title: "Szyja i ramiona",
      icon: "fas fa-head-side-virus",
      exercises: [
        { name: "Rotacja szyi", duration: 45, description: "Obracaj głowę powoli w lewo i prawo, zatrzymując się na koniec zakresu na 3 sekundy. Powtórz 5 razy w każdą stronę." },
        { name: "Pochylanie szyi", duration: 45, description: "Pochylaj głowę do przodu, aż poczujesz napięcie w karku. Zatrzymaj na 5 sekund, potem do tyłu. Powtórz 5 razy." },
        { name: "Rotacja ramion", duration: 60, description: "Podnieś ramiona do uszu i obracaj je wstecz 10 razy, potem naprzód 10 razy. Powoli i kontrolowanie." },
        { name: "Rozciąganie boku szyi", duration: 60, description: "Pochyl głowę do prawego ramienia, zatrzymaj 15 sekund. Powtórz po lewej stronie." }
      ]
    },
    back: {
      title: "Plecy",
      icon: "fas fa-person-hiking",
      exercises: [
        { name: "Rozciąganie pleców", duration: 60, description: "Wstań, połóż dłonie za siebie i obracaj tułów powoli do przodu. Zatrzymaj na 15 sekund. Powtórz 3 razy." },
        { name: "Cat-cow stretch", duration: 90, description: "Stoi na czworaka. Wygib plecy do przodu, zatrzymaj 5 sekund. Potem zaokrąglij plecy, zatrzymaj 5 sekund. Powtórz 8 razy." },
        { name: "Pochylenie do przodu", duration: 75, description: "Stoi, nogi na szerokości bioder. Pochylaj się do przodu, starając się dotknąć palcami podłogi. Zatrzymaj 20 sekund." },
        { name: "Wyprost klatki piersiowej", duration: 60, description: "Stoi prosto, spłoć dłonie za plecami. Powoli podnosi ramiona do tyłu. Zatrzymaj 15 sekund. Powtórz 3 razy." }
      ]
    },
    wrists: {
      title: "Nadgarstki i dłonie",
      icon: "fas fa-hand-fist",
      exercises: [
        { name: "Rotacja nadgarstka", duration: 30, description: "Wyciągnij rękę do przodu, otwórz i zamykaj dłoń. Obracaj nadgarstkiem w kółko 10 razy w każdą stronę." },
        { name: "Rozciąganie palców", duration: 45, description: "Spłoć dłonie za sobą, przymknij oczy i powoli podnies ręce w górę. Zatrzymaj 20 sekund." },
        { name: "Masaż pięści", duration: 40, description: "Zaciskaj pięści, a następnie rozluźniaj przez 2 sekundy. Powtórz 20 razy. Potem rozciągaj palce maksymalnie." },
        { name: "Modlitewne rozciąganie", duration: 50, description: "Dłonie razem przed грудями, przesuwaj je powoli w dół, aż poczujesz napięcie. Zatrzymaj 20 sekund." }
      ]
    },
    eyes: {
      title: "Oczy",
      icon: "fas fa-eye",
      exercises: [
        { name: "Mruganie świadome", duration: 90, description: "Mrugaj powoli i świadomie przez 1,5 minuty. To nawilży oczy i rozluźni mięśnie." },
        { name: "Ruchy oczu", duration: 60, description: "Patrz w górę, dół, prawo, lewo i po przekątnych. Każdy kierunek 5 sekund. Powtórz cykl 3 razy." },
        { name: "Palming", duration: 120, description: "Zakryj oczy dłońmi (nie naciskając). Siedź w ciemności i oddychaj. 2 minuty pełnego relaksu." },
        { name: "Focus shift", duration: 300, description: "Patrz przez okno na coś daleko (min 20 m), potem na coś blisko (30 cm). Przełączaj co 10 sekund przez 5 minut." }
      ]
    },
    legs: {
      title: "Nogi",
      icon: "fas fa-person-walking",
      exercises: [
        { name: "Rozciąganie ud", duration: 50, description: "Siądź, złóż prawe nogi na lewe kolano. Pochylaj się do przodu. Zatrzymaj 20 sekund. Powtórz po drugiej stronie." },
        { name: "Rozciąganie łydek", duration: 45, description: "Siadaj przysiad, trzymając ścianę. Lewa noga zognięta, prawa wyprostowana. Zatrzymaj 20 sekund." },
        { name: "Mały spacer", duration: 180, description: "Przejdź 100-200 kroków po biurze lub korytarzu. Powoli, świadomie." },
        { name: "Ruchy nóg w siedzie", duration: 40, description: "Siedzisz i powoli unosisz prawe kolano, zatrzymujesz na 3 sekundy. Powtórz 10 razy na każdę nogę." }
      ]
    }
  },
  
  // Education articles
  articles: [
// ... (reszta obiektu state bez zmian) ...
    {
      title: "Dlaczego ergonomia stanowiska jest ważna?",
      category: "Dlaczego to ważne",
      readingTime: 3,
      content: "Prawidłowa ergonomia to nie luksus - to inwestycja w Twoje zdrowie i życie. Praca w nieergonomicznym stanowisku powoduje bóle, zmęczenie i długoterminowe problemy zdrowotne. Ponad 79% pracowników biurowych codziennie odczuwa ból bezpośrednio związany z pracą. Dobra wiadomość? Większość problemów można rozwiązać już w 2-3 tygodnie prostych zmian. To nie wymaga dużych inwestycji - często to zwykła reorganizacja przestrzeni i kilka przyzwyczajeń."
    },
    {
      title: "Kąt 90 stopni - dlaczego to magiczna liczba?",
      category: "Jak to robić",
      readingTime: 3,
      content: "Gdy kąt w kolanach wynosi ok. 90°, a uda są równolegle do podłogi, przepływ krwi jest optymalny. Gdy zawijasz nogi pod siedzenie lub przesadnie je wyciągasz, ograniczasz krążenie, co prowadzi do zakrzepów, żylaków i bólu. Stopy powinny być całkowicie podparte - jeśli wisz - użyj podnóżka. To nie detail - to podstawa. Zmiana tego jednego ustawienia może zmienić Twoje samopoczucie w 1-2 tygodnie!"
    },
    {
      title: "Monitor na wysokości oczu - dlaczego?",
      category: "Jak to robić",
      readingTime: 3,
      content: "Gdy patrzysz na monitor, twoja głowa powinna być w naturalnej pozycji (lekko do góry). Jeśli monitor jest za nisko, wysuwasz głowę do przodu - już po pół godzinie czujesz ból szyi i karku. Przez rok to staje się chronicznym bólem. Górna krawędź monitora powinna być na wysokości oczu lub trochę poniżej, w odległości wyciągniętego ramienia (50-70 cm). To jedna z najważniejszych zmian!"
    },
    {
      title: "Zespół cieśni nadgarstka - jak go unikać?",
      category: "Poradnik",
      readingTime: 4,
      content: "Piszesz wiele? Mysz w złym miejscu? To sprawca zespołu cieśni nadgarstka (TOS). Nerw przeciśnięty w kanale nadgarstka powoduje: mrowienie, ból, bezsenność. Profilaktyka: mysz na tej samej wysokości co klawiatura, nadgarstki prosto, nie zawinięte. Regularnie rozciągaj dłonie - rób to co 30 minut. Jeśli już masz objawy - dodaj podpórkę pod nadgarstki."
    },
    {
      title: "Synergia ergonomii - efekt domina",
      category: "Dlaczego to ważne",
      readingTime: 3,
      content: "Ergonomia to nie pojedyncze elementy - to system. Dobrze ustawiony monitor wymaga dobrze ustawionego krzesła. Dobre krzesło wymaga podnóżka. Podnóżek wymaga regularnych przerw i ruchu. Wszystko ze sobą współpracuje. Nawet gdy poprawisz 70% - pozostałe 30% może zniwelować efekty. Dlatego ważne jest kompleksowe podejście. Zacznij od największego problemu i powoli dodawaj kolejne zmiany."
    },
    {
      title: "Mikroprzerwami - najlepsza inwestycja",
      category: "Poradnik",
      readingTime: 4,
      content: "Nie potrzebujesz długich przerw. Wystarczy co 30-40 minut wstać na 5 minut i zrobić parę rozciągnięć. To przywraca przepływ krwi, regeneruje oczy, zmienia perspektywę. Badania pokazują, że 5-minutowa przerwa co 30 minut ZWIĘKSZA produktywność (paradoks - ale prawdziwy). Ustaw timer - ta gra zmieni Twoją pracę. Zaczynasz teraz?"
    }
  ],
  
  // Gamification
  badges: [
// ... (reszta obiektu state bez zmian) ...
    { id: 1, name: "Audyt się liczy", description: "Wykonaj swój pierwszy audyt ergonomii", icon: "fas fa-clipboard-check", points: 50, unlocked: false },
    { id: 2, name: "Zaczęty na poważnie", description: "Wykonaj pierwsze wyzwanie z planu", icon: "fas fa-forward", points: 50, unlocked: false },
    { id: 3, name: "Połowa drogi", description: "Wykonaj 5 dni z rzędu", icon: "fas fa-fire", points: 100, unlocked: false },
    { id: 4, name: "Prawie tam!", description: "Wykonaj 10 dni z rzędu", icon: "fas fa-hourglass-end", points: 100, unlocked: false },
    { id: 5, name: "Transformacja!", description: "Re-audyt wykazał wzrost 30%+", icon: "fas fa-arrow-up", points: 200, unlocked: false },
    { id: 6, name: "Legenda audytu", description: "Ukończ 10 dni + 85%+ w re-audycie", icon: "fas fa-crown", points: 150, unlocked: false },
    { id: 7, name: "Edukator", description: "Przeczytaj wszystkie artykuły", icon: "fas fa-book-open", points: 100, unlocked: false },
    { id: 8, name: "Mistrz ćwiczeń", description: "Wykonaj 15 ćwiczeń", icon: "fas fa-dumbbell", points: 150, unlocked: false },
    { id: 9, name: "Quiz Master", description: "Wykonaj Quiz Bonusowy", icon: "fas fa-brain", points: 100, unlocked: false }
  ],
  
  levels: [
// ... (reszta obiektu state bez zmian) ...
    { name: "Bronze", minPoints: 0, maxPoints: 449, description: "Zaczynam audyt", percentage: "25%" },
    { name: "Silver", minPoints: 450, maxPoints: 899, description: "Robię postępy", percentage: "50%" },
    { name: "Gold", minPoints: 900, maxPoints: 1619, description: "Mistrz ergonomii", percentage: "90%" },
    { name: "Platinum", minPoints: 1620, maxPoints: 9999, description: "Legenda ergonomii - Quiz Bonusowy Odblokowany!", percentage: "90% (pełnia)" }
  ]
};

// CAŁY OBIEKT `storage` I `storageData` ZOSTAŁ USUNIĘTY.
// PONIŻEJ ZNAJDUJE SIĘ ZASTĘPCZA LOGIKA APLIKACJI.

// Application logic
const app = {
  
  // NOWA FUNKCJA: Zapisuje cały stan do Firestore
  saveDataToFirestore: async function() {
    if (!db || !userId) {
      console.warn("Brak połączenia z bazą danych. Dane nie zostały zapisane.");
      return;
    }
    
    // Przygotuj obiekt do zapisu
    const dataToSave = {
      userName: state.userName,
      auditHistory: state.auditHistory,
      plan10Days: state.plan10Days,
      completedExercises: state.completedExercises,
      readArticles: state.readArticles,
      badges: state.badges,
      points: state.points,
      streak: state.streak,
      lastActivityDate: state.lastActivityDate,
      quizCompleted: state.quizCompleted,
      quizBonusAwarded: state.quizBonusAwarded,
      lastSave: firebase.firestore.FieldValue.serverTimestamp() // Dodaj znacznik czasu zapisu
    };
    
    try {
        // Ścieżka do dokumentu: /artifacts/{appId}/users/{userId}/app_data/main
        const userDocRef = db.collection('artifacts').doc(appId)
                             .collection('users').doc(userId)
                             .collection('app_data').doc('main');
                             
        // Użyj `set` z `{ merge: true }`, aby zaktualizować lub utworzyć dokument
        await userDocRef.set(dataToSave, { merge: true });
        console.log("Dane pomyślnie zapisane w Firestore.");

    } catch (e) {
        console.error("Błąd zapisu danych do Firestore:", e);
        this.showToast("Błąd zapisu postępów.", "error");
    }
  },

  // ZMODYFIKOWANA FUNKCJA: init()
  init(hasData) { // Otrzymuje informację, czy dane zostały załadowane
    
    if (!hasData || !state.userName) {
      // Pierwsza wizyta lub błąd ładowania
      // Pokaż ekran powitalny
      this.showWelcomeScreen();
      return;
    }
    
    // Użytkownik już istnieje, dane załadowane do `state`
    
    // Zainicjuj plan, jeśli jest pusty (na wypadek, gdyby zapis się nie udał)
    if (state.plan10Days.length === 0) {
      state.plan10Days = state.challenges.map(c => ({ ...c }));
    }
    
    // Ukryj ekran powitalny i pokaż aplikację
    this.hideWelcomeScreen();
    
    // Renderuj dashboard
    this.renderDashboard();
    this.updateDashboardKPIs();
  },
  
  showWelcomeScreen() {
// ... (bez zmian) ...
    const welcomeScreen = document.getElementById('welcomeScreen');
    const app = document.getElementById('app');
    welcomeScreen.classList.remove('hidden');
    app.style.display = 'none';
  },
  
  hideWelcomeScreen() {
// ... (bez zmian) ...
    const welcomeScreen = document.getElementById('welcomeScreen');
    const app = document.getElementById('app');
    welcomeScreen.classList.add('hidden');
    app.style.display = 'flex';
  },
  
  // ZMODYFIKOWANA FUNKCJA: startAdventure()
  async startAdventure() { // Zmieniono na async
    const nameInput = document.getElementById('userNameInput');
    const name = nameInput.value.trim();
    
    if (!name) {
      this.showToast('Proszę wpisać swoje imię!', 'error');
      return;
    }
    
    // Zapisz imię do stanu
    state.userName = name;
    // Zainicjuj plan 10-dniowy dla nowego użytkownika
    state.plan10Days = state.challenges.map(c => ({ ...c }));
    
    // *** ZMIANA: Zapisz stan do Firestore zamiast localStorage ***
    await this.saveDataToFirestore(); 
    
    // Ukryj ekran powitalny i pokaż aplikację
    this.hideWelcomeScreen();
    
    // Renderuj dashboard
    this.renderDashboard();
    this.updateDashboardKPIs();
    
    // Pokaż toast powitalny
    this.showToast(`Witaj ${name}! 🎉 Zacznijmy Twoją przygodę z ergonomią!`, 'success');
    this.triggerConfetti();
  },
  
  navigateTo(section) {
// ... (bez zmian) ...
    // Update active menu item
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });
    event.currentTarget?.classList.add('active');
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => {
      s.classList.remove('active');
    });
    
    // Show target section
    state.currentSection = section;
    const targetSection = document.getElementById(section + 'Section');
    if (targetSection) {
      targetSection.classList.add('active');
    }
    
    // Render section content
    switch(section) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'audit':
        this.renderAudit();
        break;
      case 'plan':
        this.renderPlan();
        break;
      case 'exercises':
        this.renderExercises();
        break;
      case 'education':
        this.renderEducation();
        break;
      case 'results':
        this.renderResults();
        break;
      case 'gamification':
        this.renderGamification();
        break;
    }
    
    // Scroll to top
    window.scrollTo(0, 0);
  },
  
  toggleSidebar() {
// ... (bez zmian) ...
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
  },
  
  renderDashboard() {
// ... (bez zmian) ...
    this.updateDashboardMetrics();
    this.updateGreeting();
  },
  
  updateGreeting() {
// ... (bez zmian) ...
    // Get current challenge day
    const completedDays = state.plan10Days.filter(d => d.completed).length;
    const currentDay = state.plan10Days[completedDays] || state.plan10Days[state.plan10Days.length - 1];
    
    // Use userName instead of day name
    const displayName = state.userName || 'Przyjaciół';
    document.getElementById('greetingTitle').textContent = `Witaj, ${displayName}! 🎯`;
    document.getElementById('greetingSubtitle').textContent = `Dzisiaj czeka Cię: ${currentDay.title}`;
    
    // Update CTA button
    const ctaButton = document.getElementById('dashboardCTA');
    if (currentDay.completed) {
      ctaButton.innerHTML = '<i class="fas fa-check"></i> Gratulacje! Dzisiaj już wszystko zrobiłeś! 🎉';
      ctaButton.className = 'btn btn--success btn--lg';
    } else if (completedDays > 0) {
      ctaButton.innerHTML = '<i class="fas fa-forward"></i> Kontynuuj wyzwanie';
      ctaButton.className = 'btn btn--primary btn--lg';
    } else {
      ctaButton.innerHTML = '<i class="fas fa-play"></i> Zacznij dzisiejsze wyzwanie';
      ctaButton.className = 'btn btn--primary btn--lg';
    }
    
    // Update motivational quote
    const quotes = [
      'Dzisiaj poprawiasz swoją ergonomię - jeden krok do zdrowszego kręgosłupa! 💪',
      'Twoje plecy Ci dziękują za każde wyzwanie. Jeśli się nie dziękują, rób więcej ćwiczeń! 😄',
      'Ergonomia to nie luksus, to inwestycja w Twoje przyszłe "ja" bez bólu. 🎯',
      'Pamiętaj: siedź jak król, pracuj jak uczony, ruszaj się jak atleta! 🏆',
      'Zero wyzwań opuszczonych = zero żalu jutro. Let\'s go! 🚀'
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('quoteText').textContent = randomQuote;
  },
  
  updateDashboardMetrics() {
// ... (bez zmian) ...
    // 1. Ergonomia
    const latestAudit = state.auditHistory[state.auditHistory.length - 1];
    const ergonomicsEl = document.getElementById('metricErgonomics');
    if (latestAudit) {
      ergonomicsEl.textContent = latestAudit.score + '%';
      // Update color based on score
      const card = ergonomicsEl.closest('.metric-card');
      if (latestAudit.score >= 85) {
        card.style.borderColor = 'var(--color-success)';
      } else if (latestAudit.score >= 70) {
        card.style.borderColor = 'var(--color-primary)';
      } else if (latestAudit.score >= 50) {
        card.style.borderColor = 'var(--color-warning)';
      } else {
        card.style.borderColor = 'var(--color-error)';
      }
    } else {
      ergonomicsEl.textContent = '--';
      document.getElementById('ergonomicsProgress').textContent = 'Wykonaj swój pierwszy audyt';
    }
    
    // 2. Dzisiejsze Wyzwanie
    const completedDays = state.plan10Days.filter(d => d.completed).length;
    const currentDay = state.plan10Days[completedDays];
    if (currentDay) {
      document.getElementById('metricChallenge').textContent = currentDay.title;
    } else {
      document.getElementById('metricChallenge').textContent = 'Wszystko ukończone! 🎉';
    }
    
    // 3. Streak
    document.getElementById('metricStreak').textContent = state.streak;
    
    // 4. Odznaki
    const unlockedCount = state.badges.filter(b => b.unlocked).length;
    document.getElementById('metricBadges').textContent = `${unlockedCount} / ${state.badges.length}`;
    
    // 5. Skutki zdrowotne
    const healthConsequences = this.countHealthConsequences();
    document.getElementById('metricHealth').textContent = healthConsequences;
    
    // 6. Ćwiczenia dzisiaj
    const exercisesToday = this.calculateExercisesToday();
    document.getElementById('metricExercises').textContent = exercisesToday.percentage + '%';
    document.getElementById('exercisesProgressFill').style.width = exercisesToday.percentage + '%';
    
    // 7. Gamifikacja Level
    const currentLevel = this.getCurrentLevel();
    const nextLevel = this.getNextLevel();
    document.getElementById('metricLevel').textContent = currentLevel.name;
    
    // Always show progress to Platinum (1620)
    const platinumThreshold = 1620;
    if (state.points >= platinumThreshold) {
      document.getElementById('metricPoints').textContent = `${state.points} pkt (Platinum osiągnięty! 🎉)`;
      document.getElementById('levelProgressFill').style.width = '100%';
    } else {
      const pointsToPlat = platinumThreshold - state.points;
      document.getElementById('metricPoints').textContent = `${state.points} / ${platinumThreshold} pkt do Platinum`;
      const progressPercentage = Math.round((state.points / platinumThreshold) * 100);
      document.getElementById('levelProgressFill').style.width = progressPercentage + '%';
    }
    
    // 8. Quiz Bonusowy
    this.updateQuizBonusMetric();
  },
  
  updateQuizBonusMetric() {
// ... (bez zmian) ...
    const quizCard = document.getElementById('quizBonusCard');
    const metricQuiz = document.getElementById('metricQuiz');
    const quizStatus = document.getElementById('quizStatus');
    const currentLevel = this.getCurrentLevel();
    const isPlatinum = state.points >= 1620;
    
    if (isPlatinum) {
      // Unlocked
      quizCard.classList.remove('locked');
      quizCard.classList.add('unlocked');
      
      if (state.quizCompleted) {
        quizCard.classList.add('completed');
        metricQuiz.textContent = '✓ Quiz Wykonany';
        quizStatus.textContent = 'Gratulacje! +500 pkt';
        quizStatus.style.color = 'var(--color-success)';
      } else {
        quizCard.classList.remove('completed');
        metricQuiz.textContent = 'Sprawdź swoją wiedzę!';
        quizStatus.textContent = '+500 pkt za wykonanie';
        quizStatus.style.color = 'var(--color-purple-500)';
      }
    } else {
      // Locked
      quizCard.classList.add('locked');
      quizCard.classList.remove('unlocked', 'completed');
      metricQuiz.innerHTML = '🔒 Odblokuj na Platinum';
      
      const pointsNeeded = 1620 - state.points;
      const percentToGo = Math.round((state.points / 1620) * 100);
      quizStatus.textContent = `${percentToGo}% do odblokowania (${pointsNeeded} pkt)`;
      quizStatus.style.color = 'var(--color-text-secondary)';
    }
  },
  
  // ZMODYFIKOWANA FUNKCJA: handleQuizBonus()
  handleQuizBonus() {
    const currentLevel = this.getCurrentLevel();
    const isPlatinum = state.points >= 1620;
    
    if (!isPlatinum) {
      const pointsNeeded = 1620 - state.points;
      this.showToast(`🔒 Quiz Bonusowy jest dostępny tylko dla poziomu Platinum! Potrzebujesz jeszcze ${pointsNeeded} punktów!`, 'error');
      return;
    }
    
    if (state.quizCompleted) {
      this.showToast('Quiz już został wykonany! ✓', 'success');
      return;
    }
    
    // Open Google Forms in new window
    const quizLink = 'https://forms.google.com/placeholder';
    window.open(quizLink, '_blank');
    
    // Mark as completed and award points
    state.quizCompleted = true;
    
    if (!state.quizBonusAwarded) {
      state.quizBonusAwarded = true;
      // Award quiz points without triggering level notifications
      state.points += 500;
      this.checkBadge(9); // Quiz Master badge
      this.showToast('🎉 Quiz Bonusowy wykonany! +500 punktów bonusowych!', 'success');
      this.triggerConfetti();
      // *** ZMIANA: Zapis do Firestore ***
      this.saveDataToFirestore(); 
    }
    
    // *** ZMIANA: Zapis do Firestore ***
    this.saveDataToFirestore(); 
    this.updateQuizBonusMetric();
  },
  
  countHealthConsequences() {
// ... (bez zmian) ...
    const latestAudit = state.auditHistory[state.auditHistory.length - 1];
    if (!latestAudit) return 0;
    
    const uncheckedIssues = this.getUncheckedIssues();
    return Object.keys(uncheckedIssues).length;
  },
  
  calculateExercisesToday() {
// ... (bez zmian) ...
    // Find today's challenge
    const completedDays = state.plan10Days.filter(d => d.completed).length;
    const currentDay = state.plan10Days[completedDays];
    
    if (!currentDay || currentDay.type !== 'exercise') {
      // No exercises planned for today
      return { percentage: 0, completed: 0, total: 0 };
    }
    
    // Count exercises completed today (simplified - counts all completed exercises)
    const todayExerciseCount = state.completedExercises.length;
    const targetExercises = 5; // Target for the day
    
    const percentage = Math.min(100, Math.round((todayExerciseCount / targetExercises) * 100));
    
    return { percentage, completed: todayExerciseCount, total: targetExercises };
  },
  
  showMetricTooltip(metricId) {
// ... (bez zmian) ...
    const tooltips = {
      'ergonomia': 'Ile procent Twojego stanowiska pracy jest ergonomicznie poprawne. Im wyżej, tym mniej będziesz chodzić do lekarza 🏥. Czemu nie 100%? Bo nie jesteś robotem... choć byłoby fajnie 🤖',
      'daily-challenge': 'Które z 10 dni wyzwań masz dzisiaj do wykonania. Może to bycie rewolucjonistą i dostosowanie monitora, a może spacer biurowy (aka "losowe poruszanie się po biurze" 😄)',
      'streak': 'Ile dni z rzędu nie zignorowałeś wyzwań. Jak licznik w grze! 🎮 Każdy dzień to +1 punkt do Twojego zdrowia (i do ego 💪)',
      'badges': 'Ile odznak już masz? To jak kolekcja Pokemon, ale dla Twojej ergonomii 🏆. Każda odznaka to proof że coś zrobiłeś (i że istniejesz 😎)',
      'health-consequences': 'Ile skutków zdrowotnych Twój audyt odkrył. To jak lista "rzeczy do zrobienia" ale dla Twojego ciała. Im mniej, tym lepiej! 🎯',
      'exercises-today': 'Jaki procent dzisiejszych ćwiczeń już zrobiłeś? Jeszcze 0%? Nie ma problemu, dzień dopiero się zaczyna! ☀️ Już 100%? Jesteś legend! 🌟',
      'gamification-level': 'Jakim jesteś poziomem w grze ergonomii? Bronze to początek, Platinum to legenda 👑. Punkty zbierasz za: wyzwania (50 pkt), ćwiczenia (25 pkt), odznaki (50-200 pkt). Platinum = 1620 punktów (90% pełnej puli bez quizu)!',
      'quiz-bonus': 'Bonus dla najlepszych! Osiągnij Platinum (1620+ punktów = 90% pełnej puli) i sprawdź swoją wiedzę o ergonomii. Za wykonanie quizu: +500 punktów bonusowych i specjalna odznaka Quiz Master! 🎯🧠'
    };
    
    const tooltip = document.getElementById('metricTooltip');
    const content = document.getElementById('tooltipContent');
    content.textContent = tooltips[metricId] || 'Brak opisu';
    tooltip.classList.add('show');
  },
  
  hideMetricTooltip() {
// ... (bez zmian) ...
    document.getElementById('metricTooltip').classList.remove('show');
  },
  
  handleDashboardCTA() {
// ... (bez zmian) ...
    // Navigate to plan section
    this.navigateTo('plan');
  },
  
  renderAudit() {
// ... (bez zmian) ...
    const content = document.getElementById('auditContent');
    
    let html = '<div class="audit-split-layout">';
    
    // Left side: Audit sections
    html += '<div class="audit-left-panel">';
    
    state.auditSections.forEach(section => {
      html += `
        <div class="audit-section-card" data-section-id="${section.id}">
          <div class="audit-section-header">
            <div style="font-size: 36px; color: var(--color-primary);"><i class="${section.icon}"></i></div>
            <div>
              <h3 style="margin: 0; font-size: var(--font-size-xl);">${section.title}</h3>
              <p style="margin: 0; color: var(--color-text-secondary); font-size: var(--font-size-sm);">Waga: ${section.weight}%</p>
            </div>
          </div>
      `;
      
      // Section 5: 2 monitors with dropdown
      if (section.hasMode) {
        html += `
          <div style="margin-bottom: var(--space-16);">
            <label style="display: block; margin-bottom: var(--space-8); font-weight: var(--font-weight-medium);">Tryb pracy:</label>
            <select class="form-control" onchange="app.changeMonitorMode(this.value)" style="width: 100%;">
              <option value="na" ${section.mode === 'na' ? 'selected' : ''}>Nie dotyczy</option>
              <option value="sym" ${section.mode === 'sym' ? 'selected' : ''}>Symetryczne ustawienie</option>
              <option value="mix" ${section.mode === 'mix' ? 'selected' : ''}>Jeden główny + pomocniczy</option>
            </select>
          </div>
        `;
        
        // Show questions based on mode
        if (section.mode === 'sym') {
          html += '<div class="audit-questions">';
          section.symmetricQuestions.forEach((q, idx) => {
            html += `
              <div class="audit-question-item ${q.checked ? 'checked' : 'unchecked'}">
                <label style="display: flex; align-items: flex-start; gap: var(--space-12); cursor: pointer;">
                  <input type="checkbox" 
                         ${q.checked ? 'checked' : ''}
                         onchange="app.toggleMonitorQuestion('sym', ${idx})"
                         style="width: 20px; height: 20px; margin-top: 2px; cursor: pointer; accent-color: var(--color-primary);">
                  <span style="flex: 1; line-height: 1.5;">${q.text}</span>
                  ${!q.checked ? '<i class="fas fa-exclamation-triangle" style="color: var(--color-warning); font-size: 16px; margin-top: 2px;"></i>' : ''}
                </label>
              </div>
            `;
          });
          html += '</div>';
        } else if (section.mode === 'mix') {
          html += '<div class="audit-questions">';
          section.mixedQuestions.forEach((q, idx) => {
            html += `
              <div class="audit-question-item ${q.checked ? 'checked' : 'unchecked'}">
                <label style="display: flex; align-items: flex-start; gap: var(--space-12); cursor: pointer;">
                  <input type="checkbox" 
                         ${q.checked ? 'checked' : ''}
                         onchange="app.toggleMonitorQuestion('mix', ${idx})"
                         style="width: 20px; height: 20px; margin-top: 2px; cursor: pointer; accent-color: var(--color-primary);">
                  <span style="flex: 1; line-height: 1.5;">${q.text}</span>
                  ${!q.checked ? '<i class="fas fa-exclamation-triangle" style="color: var(--color-warning); font-size: 16px; margin-top: 2px;"></i>' : ''}
                </label>
              </div>
            `;
          });
          html += '</div>';
        } else {
          html += '<p style="color: var(--color-text-secondary); padding: var(--space-16); background: var(--color-bg-2); border-radius: var(--radius-base);"><i class="fas fa-info-circle"></i> Ta sekcja nie dotyczy Twojego stanowiska</p>';
        }
      }
      // Section 6: Laptop with checkbox
      else if (section.hasApplies) {
        html += `
          <div style="margin-bottom: var(--space-16);">
            <label style="display: flex; align-items: center; gap: var(--space-12); cursor: pointer; padding: var(--space-12); background: var(--color-bg-2); border-radius: var(--radius-base);">
              <input type="checkbox" 
                     ${section.applies ? 'checked' : ''}
                     onchange="app.toggleLaptopApplies()"
                     style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--color-primary);">
              <span style="font-weight: var(--font-weight-medium);">Pracuję na laptopie</span>
            </label>
          </div>
        `;
        
        if (section.applies) {
          html += '<div class="audit-questions">';
          section.questions.forEach((q, idx) => {
            html += `
              <div class="audit-question-item ${q.checked ? 'checked' : 'unchecked'}">
                <label style="display: flex; align-items: flex-start; gap: var(--space-12); cursor: pointer;">
                  <input type="checkbox" 
                         ${q.checked ? 'checked' : ''}
                         onchange="app.toggleAuditQuestion(${section.id}, ${idx})"
                         style="width: 20px; height: 20px; margin-top: 2px; cursor: pointer; accent-color: var(--color-primary);">
                  <span style="flex: 1; line-height: 1.5;">${q.text}</span>
                  ${!q.checked ? '<i class="fas fa-exclamation-circle" style="color: var(--color-red-500); font-size: 16px; margin-top: 2px;"></i>' : ''}
                </label>
              </div>
            `;
          });
          html += '</div>';
        } else {
          html += '<p style="color: var(--color-text-secondary); padding: var(--space-16); background: var(--color-bg-2); border-radius: var(--radius-base);"><i class="fas fa-info-circle"></i> Zaznacz powyżej, jeśli pracujesz na laptopie</p>';
        }
      }
      // Regular sections
      else {
        html += '<div class="audit-questions">';
        section.questions.forEach((q, idx) => {
          html += `
            <div class="audit-question-item ${q.checked ? 'checked' : 'unchecked'}">
              <label style="display: flex; align-items: flex-start; gap: var(--space-12); cursor: pointer;">
                <input type="checkbox" 
                       ${q.checked ? 'checked' : ''}
                       onchange="app.toggleAuditQuestion(${section.id}, ${idx})"
                       style="width: 20px; height: 20px; margin-top: 2px; cursor: pointer; accent-color: var(--color-primary);">
                <span style="flex: 1; line-height: 1.5;">${q.text}</span>
                ${!q.checked ? `<i class="fas fa-exclamation-triangle" style="color: ${section.id <= 4 ? 'var(--color-orange-500)' : 'var(--color-warning)'}; font-size: 16px; margin-top: 2px;"></i>` : ''}
              </label>
            </div>
          `;
        });
        html += '</div>';
      }
      
      html += '</div>';
    });
    
    html += `
      <div style="display: flex; gap: var(--space-16); justify-content: center; margin-top: var(--space-32); padding-bottom: var(--space-32);">
        <button class="btn btn--primary btn--lg" onclick="app.completeAudit()">
          <i class="fas fa-check"></i> Zakończ audyt
        </button>
      </div>
    `;
    html += '</div>'; // End audit-left-panel
    
    // Right side: Consequences panel
    html += '<div class="audit-right-panel" id="consequencesPanel">';
    html += this.renderConsequencesPanel();
    html += '</div>';
    
    html += '</div>'; // End audit-split-layout
    content.innerHTML = html;
  },
  
  toggleAuditQuestion(sectionId, questionIdx) {
// ... (bez zmian) ...
    const section = state.auditSections.find(s => s.id === sectionId);
    if (section && section.questions[questionIdx]) {
      section.questions[questionIdx].checked = !section.questions[questionIdx].checked;
      this.updateConsequencesPanel();
    }
  },
  
  changeMonitorMode(mode) {
// ... (bez zmian) ...
    const section = state.auditSections.find(s => s.id === 5);
    if (section) {
      section.mode = mode;
      this.renderAudit();
    }
  },
  
  toggleMonitorQuestion(type, idx) {
// ... (bez zmian) ...
    const section = state.auditSections.find(s => s.id === 5);
    if (!section) return;
    
    const questions = type === 'sym' ? section.symmetricQuestions : section.mixedQuestions;
    if (questions[idx]) {
      questions[idx].checked = !questions[idx].checked;
      this.updateConsequencesPanel();
    }
  },
  
  toggleLaptopApplies() {
// ... (bez zmian) ...
    const section = state.auditSections.find(s => s.id === 6);
    if (section) {
      section.applies = !section.applies;
      this.renderAudit();
    }
  },
  
  renderConsequencesPanel() {
// ... (bez zmian) ...
    const uncheckedIssues = this.getUncheckedIssues();
    
    let html = `
      <div class="consequences-header">
        <h3><i class="fas fa-heartbeat"></i> Panel Skutków Zdrowotnych</h3>
        <p style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin-top: var(--space-8);">Aktualizuje się na żywo podczas wypełniania audytu</p>
      </div>
    `;
    
    if (Object.keys(uncheckedIssues).length === 0) {
      html += `
        <div class="consequences-empty">
          <div style="font-size: 64px; color: var(--color-success); margin-bottom: var(--space-16);">
            <i class="fas fa-check-circle"></i>
          </div>
          <h4 style="color: var(--color-success); margin-bottom: var(--space-8);">Świetnie!</h4>
          <p style="color: var(--color-text-secondary);">Wszystkie punkty ergonomiczne spełnione. Kontynuuj dobrą pracę!</p>
        </div>
      `;
    } else {
      // Sort by urgency
      const sortedIssues = Object.entries(uncheckedIssues).sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2 };
        return urgencyOrder[a[1].urgency] - urgencyOrder[b[1].urgency];
      });
      
      html += '<div class="consequences-list">';
      
      sortedIssues.forEach(([riskKey, data]) => {
        const consequence = state.healthConsequences[riskKey];
        if (!consequence) return;
        
        const urgencyIcon = consequence.urgency === 'critical' ? 'fa-circle-exclamation' : 
                           consequence.urgency === 'high' ? 'fa-triangle-exclamation' : 'fa-exclamation';
        const urgencyLabel = consequence.urgency === 'critical' ? 'KRYTYCZNE' : 
                            consequence.urgency === 'high' ? 'WYSOKIE' : 'ŚREDNIE';
        
        html += `
          <div class="consequence-card consequence-${consequence.urgency}" style="animation: slideIn 0.3s ease-out;">
            <div class="consequence-header">
              <div style="display: flex; align-items: center; gap: var(--space-12);">
                <i class="${consequence.icon}" style="font-size: 28px; color: ${consequence.color};"></i>
                <div>
                  <div class="consequence-urgency">
                    <i class="fas ${urgencyIcon}"></i> ${urgencyLabel}
                  </div>
                  <h4 style="margin: var(--space-4) 0 0 0; font-size: var(--font-size-lg);">${consequence.name}</h4>
                </div>
              </div>
            </div>
            <div class="consequence-body">
              <div style="margin-bottom: var(--space-12);">
                <strong style="color: var(--color-text); display: block; margin-bottom: var(--space-8);">Skutki zdrowotne:</strong>
                <ul style="margin: 0; padding-left: var(--space-20); color: var(--color-text-secondary);">
                  ${consequence.effects.map(effect => `<li style="margin-bottom: var(--space-4);">${effect}</li>`).join('')}
                </ul>
              </div>
              <div>
                <strong style="color: var(--color-text); display: block; margin-bottom: var(--space-8);">Co zrobić:</strong>
                <ul style="margin: 0; padding-left: var(--space-20); color: var(--color-primary);">
                  ${consequence.actionItems.map(action => `<li style="margin-bottom: var(--space-4);">${action}</li>`).join('')}
                </ul>
              </div>
            </div>
            <div class="consequence-footer">
              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                <i class="fas fa-exclamation-circle"></i> ${data.count} ${data.count === 1 ? 'niezaznaczony punkt' : 'niezaznaczone punkty'}
              </span>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
    }
    
    return html;
  },
  
  getUncheckedIssues() {
// ... (bez zmian) ...
    const issues = {};
    
    state.auditSections.forEach(section => {
      // Regular sections
      if (!section.hasMode && !section.hasApplies) {
        section.questions.forEach(q => {
          if (!q.checked && q.healthRisk) {
            if (!issues[q.healthRisk]) {
              issues[q.healthRisk] = {
                urgency: state.healthConsequences[q.healthRisk]?.urgency || 'medium',
                count: 0
              };
            }
            issues[q.healthRisk].count++;
          }
        });
      }
      // 2 monitors section
      else if (section.hasMode && section.mode !== 'na') {
        const questions = section.mode === 'sym' ? section.symmetricQuestions : section.mixedQuestions;
        questions.forEach(q => {
          if (!q.checked && q.healthRisk) {
            if (!issues[q.healthRisk]) {
              issues[q.healthRisk] = {
                urgency: state.healthConsequences[q.healthRisk]?.urgency || 'medium',
                count: 0
              };
            }
            issues[q.healthRisk].count++;
          }
        });
      }
      // Laptop section
      else if (section.hasApplies && section.applies) {
        section.questions.forEach(q => {
          if (!q.checked && q.healthRisk) {
            if (!issues[q.healthRisk]) {
              issues[q.healthRisk] = {
                urgency: state.healthConsequences[q.healthRisk]?.urgency || 'medium',
                count: 0
              };
            }
            issues[q.healthRisk].count++;
          }
        });
      }
    });
    
    return issues;
  },
  
  updateConsequencesPanel() {
// ... (bez zmian) ...
    const panel = document.getElementById('consequencesPanel');
    if (panel) {
      panel.innerHTML = this.renderConsequencesPanel();
    }
  },
  
  updateDashboardKPIs() {
// ... (bez zmian) ...
    // Legacy function for compatibility
    this.updateDashboardMetrics();
  },
  
  // ZMODYFIKOWANA FUNKCJA: completeAudit()
  completeAudit() {
    // *** ZMIANA: Usunięto storage.save() na początku ***
    
    // Calculate score
    let totalWeight = 0;
// ... (reszta logiki obliczania wyniku bez zmian) ...
    let achievedWeight = 0;
    let uncheckedItems = [];
    
    state.auditSections.forEach(section => {
      // Regular sections
      if (!section.hasMode && !section.hasApplies) {
        section.questions.forEach(q => {
          totalWeight += q.weight;
          if (q.checked) {
            achievedWeight += q.weight;
          } else {
            uncheckedItems.push({
              section: section.title,
              question: q.text,
              sectionIcon: section.icon,
              healthRisk: q.healthRisk
            });
          }
        });
      }
      // 2 monitors section
      else if (section.hasMode) {
        if (section.mode !== 'na') {
          const questions = section.mode === 'sym' ? section.symmetricQuestions : section.mixedQuestions;
          questions.forEach(q => {
            totalWeight += q.weight;
            if (q.checked) {
              achievedWeight += q.weight;
            } else {
              uncheckedItems.push({
                section: section.title,
                question: q.text,
                sectionIcon: section.icon,
                healthRisk: q.healthRisk
              });
            }
          });
        }
        // If "not applicable", don't count this section's weight
      }
      // Laptop section
      else if (section.hasApplies) {
        if (section.applies) {
          section.questions.forEach(q => {
            totalWeight += q.weight;
            if (q.checked) {
              achievedWeight += q.weight;
            } else {
              uncheckedItems.push({
                section: section.title,
                question: q.text,
                sectionIcon: section.icon,
                healthRisk: q.healthRisk
              });
            }
          });
        }
        // If not applicable, don't count
      }
    });
    
    const score = Math.round((achievedWeight / totalWeight) * 100);
    const statusInfo = this.getStatusInfo(score);
    
    // Save audit result
    const auditResult = {
      date: new Date().toISOString(),
      score: score,
      // Robimy głęboką kopię sekcji audytu, aby zamrozić stan
      sections: JSON.parse(JSON.stringify(state.auditSections)), 
      uncheckedItems: uncheckedItems
    };
    
    state.auditHistory.push(auditResult);
    
    // *** ZMIANA: Zapis do Firestore zamiast storage.save() ***
    // Zapisujemy stan PO dodaniu punktów i odznak
    // this.saveDataToFirestore(); // Przeniesione po addPoints
    
    // Check for badges
    this.checkBadge(1); // First audit
    
    // Check for transformation badge
    if (state.auditHistory.length > 1) {
      const firstScore = state.auditHistory[0].score;
      const improvement = ((score - firstScore) / firstScore) * 100;
      if (improvement >= 30) {
        this.checkBadge(5); // Transformation
      }
    }
    
    // Check legend badge
    const completedAll = state.plan10Days.filter(d => d.completed).length === 10;
    if (completedAll && score >= 85) {
      this.checkBadge(6); // Legend
    }
    
    this.addPoints(50); // Ta funkcja już zapisuje do Firestore
    this.showToast('Audyt ukończony! +50 punktów', 'success');
    
    // Show personalized plan immediately
    this.showPersonalizedPlan(auditResult);
  },
  
  showPersonalizedPlan(auditResult) {
// ... (bez zmian) ...
    const content = document.getElementById('auditContent');
    const statusInfo = this.getStatusInfo(auditResult.score);
    
    let html = `
      <div style="max-width: 900px; margin: 0 auto;">
        <div style="text-align: center; background: var(--color-surface); border: 2px solid var(--color-card-border); border-radius: var(--radius-xl); padding: var(--space-48) var(--space-32); margin-bottom: var(--space-32);">
          <div style="font-size: 80px; font-weight: var(--font-weight-bold); color: ${statusInfo.color}; margin-bottom: var(--space-16);">${auditResult.score}%</div>
          <div style="font-size: var(--font-size-2xl); font-weight: var(--font-weight-semibold); margin-bottom: var(--space-8);">${statusInfo.label}</div>
          <div style="color: var(--color-text-secondary);">Twój wynik audytu ergonomii</div>
        </div>
        
        <div style="background: var(--color-bg-2); border: 2px solid var(--color-card-border); border-radius: var(--radius-lg); padding: var(--space-32); margin-bottom: var(--space-32);">
          <h3 style="font-size: var(--font-size-2xl); margin-bottom: var(--space-20); display: flex; align-items: center; gap: var(--space-12);">
            <i class="fas fa-list-check" style="color: var(--color-primary);"></i>
            Mój Spersonalizowany Plan Wyzwań
          </h3>
    `;
    
    if (auditResult.uncheckedItems.length > 0) {
      html += '<p style="margin-bottom: var(--space-20); color: var(--color-text-secondary);">Oto obszary, które wymagają poprawy:</p>';
      
      // Group by health risk
      const groupedByRisk = {};
      auditResult.uncheckedItems.forEach(item => {
        if (!groupedByRisk[item.healthRisk]) {
          groupedByRisk[item.healthRisk] = [];
        }
        groupedByRisk[item.healthRisk].push(item);
      });
      
      // Sort by urgency
      const sortedRisks = Object.entries(groupedByRisk).sort((a, b) => {
        const urgencyOrder = { critical: 0, high: 1, medium: 2 };
        const urgencyA = state.healthConsequences[a[0]]?.urgency || 'medium';
        const urgencyB = state.healthConsequences[b[0]]?.urgency || 'medium';
        return urgencyOrder[urgencyA] - urgencyOrder[urgencyB];
      });
      
      sortedRisks.forEach(([riskKey, items]) => {
        const consequence = state.healthConsequences[riskKey];
        if (!consequence) return;
        
        const borderColor = consequence.urgency === 'critical' ? 'var(--color-red-500)' :
                           consequence.urgency === 'high' ? 'var(--color-orange-500)' : 'var(--color-yellow-500)';
        
        html += `
          <div style="background: var(--color-surface); padding: var(--space-20); border-radius: var(--radius-base); margin-bottom: var(--space-16); border-left: 4px solid ${borderColor};">
            <div style="display: flex; align-items: flex-start; gap: var(--space-12); margin-bottom: var(--space-12);">
              <i class="${consequence.icon}" style="font-size: 24px; color: ${borderColor}; margin-top: 2px;"></i>
              <div style="flex: 1;">
                <div style="font-weight: var(--font-weight-bold); margin-bottom: var(--space-4); font-size: var(--font-size-lg);">${consequence.name}</div>
                <div style="font-size: var(--font-size-xs); color: ${borderColor}; font-weight: var(--font-weight-bold); text-transform: uppercase; margin-bottom: var(--space-8);">
                  ${consequence.urgency === 'critical' ? '⚠️ KRYTYCZNE' : consequence.urgency === 'high' ? '🔺 WYSOKIE' : '⚠️ ŚREDNIE'}
                </div>
              </div>
            </div>
            <div style="margin-bottom: var(--space-12); padding-left: var(--space-32);">
              <strong style="display: block; margin-bottom: var(--space-4); font-size: var(--font-size-sm);">Niezaznaczone punkty:</strong>
              ${items.map(item => `<div style="color: var(--color-text-secondary); font-size: var(--font-size-sm); margin-bottom: var(--space-4);">• ${item.question}</div>`).join('')}
            </div>
            <div style="padding-left: var(--space-32);">
              <strong style="display: block; margin-bottom: var(--space-4); font-size: var(--font-size-sm);">Skutki:</strong>
              <div style="color: var(--color-text-secondary); font-size: var(--font-size-sm);">${consequence.effects.slice(0, 2).join(', ')}</div>
            </div>
          </div>
        `;
      });
    } else {
      html += '<p style="color: var(--color-success); font-weight: var(--font-weight-semibold);"><i class="fas fa-check-circle"></i> Wszystkie punkty spełnione! Gratulacje!</p>';
    }
    
    html += '</div>';
    
    // Comparison with previous audit
    if (state.auditHistory.length > 1) {
      const prevAudit = state.auditHistory[state.auditHistory.length - 2];
      const improvement = auditResult.score - prevAudit.score;
      html += `
        <div style="background: var(--color-surface); border: 2px solid var(--color-card-border); border-radius: var(--radius-lg); padding: var(--space-24); margin-bottom: var(--space-32);">
          <h3 style="margin-bottom: var(--space-16);"><i class="fas fa-chart-line"></i> Porównanie z poprzednim audytem</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-16);">
            <div style="text-align: center; padding: var(--space-16); background: var(--color-bg-1); border-radius: var(--radius-base);">
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Poprzedni</div>
              <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold);">${prevAudit.score}%</div>
            </div>
            <div style="text-align: center; padding: var(--space-16); background: ${improvement > 0 ? 'var(--color-bg-3)' : 'var(--color-bg-4)'}; border-radius: var(--radius-base);">
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Zmiana</div>
              <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: ${improvement > 0 ? 'var(--color-success)' : 'var(--color-error)'};">  ${improvement > 0 ? '+' : ''}${improvement}%</div>
            </div>
            <div style="text-align: center; padding: var(--space-16); background: var(--color-bg-1); border-radius: var(--radius-base);">
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Aktualny</div>
              <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--color-primary);">${auditResult.score}%</div>
            </div>
          </div>
        </div>
      `;
    }
    
    html += `
        <div style="display: flex; gap: var(--space-16); justify-content: center; flex-wrap: wrap;">
          <button class="btn btn--primary btn--lg" onclick="app.navigateTo('plan')">
            <i class="fas fa-calendar-check"></i> Przejdź do wyzwań 10-dniowych
          </button>
          <button class="btn btn--outline btn--lg" onclick="app.navigateTo('results')">
            <i class="fas fa-chart-line"></i> Zobacz szczegółowe wyniki
          </button>
          <button class="btn btn--outline btn--lg" onclick="app.renderAudit()">
            <i class="fas fa-redo"></i> Nowy audyt
          </button>
        </div>
      </div>
    `;
    
    content.innerHTML = html;
  },
  
  showAuditHistory() {
// ... (bez zmian) ...
    if (state.auditHistory.length === 0) {
      this.showToast('Brak historii audytów', 'error');
      return;
    }
    
    let html = '<div style="max-width: 800px; margin: 0 auto;">';
    html += '<h3 style="margin-bottom: var(--space-24);">Historia audytów</h3>';
    
    state.auditHistory.forEach((audit, idx) => {
      const date = new Date(audit.date).toLocaleDateString('pl-PL');
      html += `
        <div style="background: var(--color-surface); border: 2px solid var(--color-card-border); border-radius: var(--radius-lg); padding: var(--space-20); margin-bottom: var(--space-16);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Audyt #${idx + 1} - ${date}</div>
              <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--color-primary); margin-top: var(--space-4);">${audit.score}%</div>
            </div>
            ${idx > 0 ? `
              <div style="text-align: right;">
                <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">Zmiana</div>
                <div style="font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: ${audit.score > state.auditHistory[idx-1].score ? 'var(--color-success)' : 'var(--color-error)'};">  ${audit.score - state.auditHistory[idx-1].score > 0 ? '+' : ''}${audit.score - state.auditHistory[idx-1].score}%</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    const content = document.getElementById('auditContent');
    content.innerHTML = html;
  },
  
  renderPlan() {
// ... (bez zmian) ...
    // Update progress bar
    const completed = state.plan10Days.filter(d => d.completed).length;
    const percentage = Math.round((completed / state.plan10Days.length) * 100);
    
    document.getElementById('planProgressFill').style.width = percentage + '%';
    document.getElementById('planProgressText').textContent = percentage + '% ukończono';
    document.getElementById('streakInfo').textContent = `Masz ${state.streak} dni z rzędu!`;
    
    // Check if any challenge was completed today
    const today = new Date().toDateString();
    const completedToday = state.plan10Days.find(d => d.completed && d.completedDate === today);
    
    // Render days
    const content = document.getElementById('planContent');
    let html = '';
    
    // Week mottos
    html += '<div style="text-align: center; margin-bottom: var(--space-32);">';
    html += '<div style="display: inline-block; padding: var(--space-12) var(--space-24); background: var(--color-bg-5); border-radius: var(--radius-full); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text);"><i class="fas fa-star" style="color: var(--color-warning);"></i> Tydzień 1: Podstawy to klucz!</div>';
    html += '</div>';
    
    state.plan10Days.forEach((day, idx) => {
      // Add week 2 motto before day 6
      if (idx === 5) {
        html += '</div><div style="text-align: center; margin: var(--space-32) 0;"><div style="display: inline-block; padding: var(--space-12) var(--space-24); background: var(--color-bg-1); border-radius: var(--radius-full); font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold); color: var(--color-text);"><i class="fas fa-flag-checkered" style="color: var(--color-primary);"></i> Tydzień 2: Finalna prosta!</div></div><div class="plan-days-grid">';
      }
      
      // Check if this challenge should be blocked
      const isBlocked = completedToday && !day.completed && completedToday !== day;
      
      if (idx === 0) html += '<div class="plan-days-grid">';
      html += `
        <div class="plan-day-card ${day.completed ? 'completed' : ''} ${isBlocked ? 'blocked' : ''}">
          <div class="plan-day-header">
            <div class="day-number">${day.day}</div>
            <div style="flex: 1;">
              <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-4);">${day.dayOfWeek}</div>
              <div class="day-title">${day.title}</div>
            </div>
            ${isBlocked ? '<div style="font-size: 24px; color: var(--color-text-secondary); opacity: 0.5;">🔒</div>' : ''}
          </div>
          <div class="day-task">${day.task}</div>
          <div class="day-footer">
            <div class="day-type">
              <i class="${this.getDayTypeIcon(day.type)}"></i> ${this.getDayTypeLabel(day.type)}
            </div>
            <div class="day-checkbox">
              <input type="checkbox" 
                     id="day-${idx}" 
                     ${day.completed ? 'checked' : ''}
                     ${isBlocked ? 'disabled' : ''}
                     onchange="app.toggleDay(${idx})">
              <label for="day-${idx}" style="${isBlocked ? 'opacity: 0.5; cursor: not-allowed;' : ''}">${isBlocked ? 'Zablokowane' : 'Wykonane'}</label>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    content.innerHTML = html;
  },
  
  getDayTypeIcon(type) {
// ... (bez zmian) ...
    const icons = {
      audit: 'fas fa-clipboard-check',
      action: 'fas fa-cog',
      exercise: 'fas fa-dumbbell',
      education: 'fas fa-book',
      reflection: 'fas fa-lightbulb',
      habit: 'fas fa-repeat',
      celebration: 'fas fa-trophy'
    };
    return icons[type] || 'fas fa-circle';
  },
  
  getDayTypeLabel(type) {
// ... (bez zmian) ...
    const labels = {
      audit: 'Audyt',
      action: 'Akcja',
      exercise: 'Ćwiczenie',
      education: 'Edukacja',
      reflection: 'Refleksja',
      habit: 'Nawyk',
      celebration: 'Gratulacje'
    };
    return labels[type] || type;
  },
  
  // ZMODYFIKOWANA FUNKCJA: toggleDay()
  toggleDay(idx) {
    const today = new Date().toDateString();
    const challenge = state.plan10Days[idx];
    
    // Check if trying to complete a challenge
    if (!challenge.completed) {
      // Check if another challenge was already completed today
      const completedToday = state.plan10Days.find(d => 
        d.completed && d.completedDate === today
      );
      
      if (completedToday) {
        // Block - show toast
        this.showToast('Raz na dzień! Jedno wyzwanie dziennie to klucz do konsekwencji 🔑', 'error');
        // *** WAŻNE: Resetuj checkbox, bo kliknięcie go zmieniło, ale akcja jest blokowana
        document.getElementById(`day-${idx}`).checked = false; 
        return;
      }
      
      // Allow completion
      challenge.completed = true;
      challenge.completedDate = today;
      this.addPoints(50); // Ta funkcja zapisuje i aktualizuje streak
      this.updateStreak(); // Upewnij się, że streak jest aktualny
      this.showToast('Dzień ukończony! +50 punktów', 'success'); // Zwiększono punkty do 50
      
      // Check badges
      const completed = state.plan10Days.filter(d => d.completed).length;
      if (completed >= 1) this.checkBadge(2); // Started seriously
      if (completed >= 5) this.checkBadge(3); // 5 days
      if (completed >= 10) this.checkBadge(4); // 10 days
      
      // *** ZMIANA: Zapis do Firestore (jest już w addPoints) ***
      // this.saveDataToFirestore(); // Niepotrzebne, addPoints już to robi
    } else {
      // Allow unchecking (może warto to przemyśleć, ale na razie zostawiam)
      challenge.completed = false;
      challenge.completedDate = null;
      // *** ZMIANA: Zapis do Firestore ***
      this.saveDataToFirestore(); // Zapisz stan po odznaczeniu
    }
    
    this.renderPlan();
  },
  
  // ZMODYFIKOWANA FUNKCJA: resetPlan()
  resetPlan() {
    // *** ZMIANA: Użycie własnego modala zamiast confirm() ***
    this.showConfirmationModal(
      'Czy na pewno chcesz zresetować plan? Wszystkie postępy zostaną utracone.',
      () => {
        state.plan10Days = state.challenges.map(c => ({ ...c, completed: false, completedDate: null }));
        // *** ZMIANA: Zapis do Firestore ***
        this.saveDataToFirestore();
        this.renderPlan();
        this.showToast('Plan zresetowany', 'success');
      }
    );
  },
  
  // NOWA FUNKCJA: Modal potwierdzający (zastępuje confirm())
  showConfirmationModal(message, onConfirm) {
      const modal = document.getElementById('exerciseModal'); // Użyjemy istniejącego modala
      const content = document.getElementById('exerciseModalContent');

      content.innerHTML = `
          <div style="padding: 20px; text-align: center;">
              <h3 style="margin-bottom: 20px;">Potwierdzenie</h3>
              <p style="margin-bottom: 30px; font-size: 1.1em;">${message}</p>
              <div style="display: flex; justify-content: center; gap: 20px;">
                  <button class="btn btn--outline" id="confirmCancel">
                      <i class="fas fa-times"></i> Anuluj
                  </button>
                  <button class="btn btn--primary" id="confirmOk">
                      <i class="fas fa-check"></i> Potwierdź
                  </button>
              </div>
          </div>
      `;

      modal.classList.add('show');

      document.getElementById('confirmOk').onclick = () => {
          onConfirm();
          this.closeExerciseModal();
      };
      document.getElementById('confirmCancel').onclick = () => {
          this.closeExerciseModal();
      };
  },
  
  renderExercises() {
// ... (bez zmian) ...
    const content = document.getElementById('exercisesContent');
    let html = '<div class="exercise-categories">';
    
    Object.entries(state.exercises).forEach(([key, category]) => {
      html += `
        <div class="exercise-category">
          <div class="category-header">
            <div class="category-icon"><i class="${category.icon}"></i></div>
            <div class="category-title">${category.title}</div>
          </div>
          <ul class="exercise-list">
            ${category.exercises.map((ex, idx) => `
              <li class="exercise-item" onclick="app.startExercise('${key}', ${idx})">
                <div class="exercise-item-header">
                  <div class="exercise-name">${ex.name}</div>
                  <div class="exercise-duration"><i class="fas fa-clock"></i> ${ex.duration}s</div>
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    });
    
    html += '</div>';
    content.innerHTML = html;
  },
  
  startExercise(categoryKey, exerciseIdx) {
// ... (bez zmian) ...
    const exercise = state.exercises[categoryKey].exercises[exerciseIdx];
    const modal = document.getElementById('exerciseModal');
    const content = document.getElementById('exerciseModalContent');
    
    let timeLeft = exercise.duration;
    let timerInterval;
    
    const formatTime = (seconds) => {
      if (seconds >= 60) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
      }
      return `${seconds}s`;
    };
    
    const updateTimer = () => {
      const timerValueEl = document.getElementById('timerValue');
      if (!timerValueEl) { // Sprawdź czy element istnieje (modal mógł zostać zamknięty)
          clearInterval(timerInterval);
          return;
      }
      timerValueEl.textContent = formatTime(timeLeft);
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerValueEl.textContent = 'Wykonane!';
        timerValueEl.style.color = 'var(--color-success)';
        this.completeExercise(categoryKey, exerciseIdx);
        setTimeout(() => {
          this.closeExerciseModal();
        }, 1500);
      }
      timeLeft--;
    };
    
    content.innerHTML = `
      <div class="timer-display">
        <div class="timer-circle" id="timerValue">${formatTime(timeLeft)}</div>
        <div class="timer-exercise-name">${exercise.name}</div>
        <div class="timer-description">${exercise.description}</div>
        <div class="timer-controls">
          <button class="btn btn--primary" onclick="app.closeExerciseModal()">
            <i class="fas fa-stop"></i> Zatrzymaj
          </button>
        </div>
      </div>
    `;
    
    modal.classList.add('show');
    timerInterval = setInterval(updateTimer, 1000);
    
    // Store interval so we can clear it when modal closes
    modal.timerInterval = timerInterval;
  },
  
  // ZMODYFIKOWANA FUNKCJA: completeExercise()
  completeExercise(categoryKey, exerciseIdx) {
    const exerciseId = `${categoryKey}-${exerciseIdx}`;
    if (!state.completedExercises.includes(exerciseId)) {
      state.completedExercises.push(exerciseId);
      this.addPoints(25); // Ta funkcja już zapisuje do Firestore
      this.showToast('Ćwiczenie ukończone! +25 punktów', 'success');
      
      // Check badge
      if (state.completedExercises.length >= 15) {
        this.checkBadge(8); // Master of exercises
      }
      
      // *** ZMIANA: Zapis do Firestore (jest już w addPoints) ***
      // this.saveDataToFirestore(); // Niepotrzebne
    }
    
    // Play sound (simple beep)
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      oscillator.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      // Audio not supported, skip
    }
  },
  
  closeExerciseModal() {
// ... (bez zmian) ...
    const modal = document.getElementById('exerciseModal');
    if (modal.timerInterval) {
      clearInterval(modal.timerInterval);
      modal.timerInterval = null;
    }
    modal.classList.remove('show');
    // Wyczyść zawartość, aby zapobiec błędom timera
    const content = document.getElementById('exerciseModalContent');
    if(content) content.innerHTML = ''; 
  },
  
  renderEducation() {
// ... (bez zmian) ...
    const content = document.getElementById('educationContent');
    let html = '';
    
    state.articles.forEach((article, idx) => {
      const isRead = state.readArticles.includes(idx);
      html += `
        <div class="article-card" onclick="app.openArticle(${idx})">
          <div class="article-category">${article.category}</div>
          <div class="article-title">${article.title}</div>
          <div class="article-preview">${article.content.substring(0, 100)}...</div>
          <div class="article-footer">
            <span><i class="fas fa-clock"></i> ${article.readingTime} min</span>
            ${isRead ? '<span style="color: var(--color-success);"><i class="fas fa-check"></i> Przeczytane</span>' : ''}
          </div>
        </div>
      `;
    });
    
    content.innerHTML = html;
  },
  
  openArticle(idx) {
// ... (bez zmian) ...
    const article = state.articles[idx];
    const modal = document.getElementById('articleModal');
    const content = document.getElementById('articleModalContent');
    
    content.innerHTML = `
      <div style="max-width: 700px; margin: 0 auto;">
        <div style="display: inline-block; padding: var(--space-4) var(--space-12); background: var(--color-bg-5); color: var(--color-purple-500); border-radius: var(--radius-full); font-size: var(--font-size-xs); margin-bottom: var(--space-12);">
          ${article.category}
        </div>
        <h2 style="font-size: var(--font-size-3xl); margin-bottom: var(--space-16);">${article.title}</h2>
        <div style="color: var(--color-text-secondary); margin-bottom: var(--space-24); font-size: var(--font-size-sm);">
          <i class="fas fa-clock"></i> ${article.readingTime} min czytania
        </div>
        <div style="line-height: 1.8; font-size: var(--font-size-base); color: var(--color-text);">
          ${article.content}
        </div>
        <div style="margin-top: var(--space-32); text-align: center;">
          <button class="btn btn--primary" onclick="app.markArticleRead(${idx})">
            <i class="fas fa-check"></i> Oznacz jako przeczytane
          </button>
        </div>
      </div>
    `;
    
    modal.classList.add('show');
  },
  
  // ZMODYFIKOWANA FUNKCJA: markArticleRead()
  markArticleRead(idx) {
    if (!state.readArticles.includes(idx)) {
      state.readArticles.push(idx);
      this.addPoints(30); // Ta funkcja już zapisuje do Firestore
      this.showToast('Artykuł przeczytany! +30 punktów', 'success');
      
      // Check badges
      if (state.readArticles.length === state.articles.length) {
        this.checkBadge(7); // Educator
      }
      
      // *** ZMIANA: Zapis do Firestore (jest już w addPoints) ***
      // this.saveDataToFirestore(); // Niepotrzebne
    }
    
    this.closeArticleModal();
    this.renderEducation();
  },
  
  closeArticleModal() {
// ... (bez zmian) ...
    document.getElementById('articleModal').classList.remove('show');
  },
  
  renderResults() {
// ... (bez zmian) ...
    const content = document.getElementById('resultsContent');
    
    if (state.auditHistory.length === 0) {
      content.innerHTML = `
        <div style="text-align: center; padding: var(--space-48);">
          <div style="font-size: 64px; color: var(--color-text-secondary); margin-bottom: var(--space-24);">
            <i class="fas fa-chart-line"></i>
          </div>
          <h3 style="margin-bottom: var(--space-16);">Brak wyników</h3>
          <p style="color: var(--color-text-secondary); margin-bottom: var(--space-24);">Wykonaj pierwszy audyt ergonomii, aby zobaczyć swoje wyniki.</p>
          <button class="btn btn--primary" onclick="app.navigateTo('audit')">
            <i class="fas fa-play"></i> Rozpocznij audyt
          </button>
        </div>
      `;
      return;
    }
    
    const latestAudit = state.auditHistory[state.auditHistory.length - 1];
    const statusInfo = this.getStatusInfo(latestAudit.score);
    
    let html = `
      <div class="results-main-stat">
        <div class="main-stat-value" style="color: ${statusInfo.color};">${latestAudit.score}%</div>
        <div class="main-stat-label">${statusInfo.label}</div>
      </div>
      
      <div class="results-grid">
        <div class="result-card">
          <div class="result-card-header">
            <div class="result-card-title">Dni w wyzwaniu</div>
            <div class="result-card-value">${state.plan10Days.filter(d => d.completed).length}/10</div>
          </div>
        </div>
        <div class="result-card">
          <div class="result-card-header">
            <div class="result-card-title">Ćwiczenia</div>
            <div class="result-card-value">${state.completedExercises.length}</div>
          </div>
        </div>
        <div class="result-card">
          <div class="result-card-header">
            <div class="result-card-title">Artykuły</div>
            <div class="result-card-value">${state.readArticles.length}/${state.articles.length}</div>
          </div>
        </div>
        <div class="result-card">
          <div class="result-card-header">
            <div class="result-card-title">Streak</div>
            <div class="result-card-value">${state.streak} dni</div>
          </div>
        </div>
      </div>
    `;
    
    // Audit history comparison
    if (state.auditHistory.length > 1) {
      html += '<div style="background: var(--color-surface); border: 2px solid var(--color-card-border); border-radius: var(--radius-lg); padding: var(--space-24); margin-top: var(--space-32);">';
      html += '<h3 style="margin-bottom: var(--space-20);"><i class="fas fa-chart-line"></i> Porównanie audytów - Przed i Po</h3>';
      
      const firstAudit = state.auditHistory[0];
      const lastAudit = state.auditHistory[state.auditHistory.length - 1];
      const improvement = lastAudit.score - firstAudit.score;
      const improvementPercent = firstAudit.score > 0 ? Math.round((improvement / firstAudit.score) * 100) : (improvement > 0 ? 100 : 0); // Unikaj dzielenia przez zero
      
      html += `
        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: var(--space-24); align-items: center; margin-bottom: var(--space-24);">
          <div style="text-align: center; padding: var(--space-24); background: var(--color-bg-1); border-radius: var(--radius-lg);">
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-8);">Pierwszy audyt</div>
            <div style="font-size: 48px; font-weight: var(--font-weight-bold); color: var(--color-text);">${firstAudit.score}%</div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-4);">${new Date(firstAudit.date).toLocaleDateString('pl-PL')}</div>
          </div>
          <div style="text-align: center;">
            <i class="fas fa-arrow-right" style="font-size: 32px; color: ${improvement > 0 ? 'var(--color-success)' : 'var(--color-text-secondary)'}"></i>
            <div style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: ${improvement > 0 ? 'var(--color-success)' : 'var(--color-error)'}; margin-top: var(--space-8);">${improvement > 0 ? '+' : ''}${improvement}%</div>
          </div>
          <div style="text-align: center; padding: var(--space-24); background: var(--color-bg-3); border-radius: var(--radius-lg); border: 2px solid var(--color-success);">
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-8);">Ostatni audyt</div>
            <div style="font-size: 48px; font-weight: var(--font-weight-bold); color: var(--color-success);">${lastAudit.score}%</div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-4);">${new Date(lastAudit.date).toLocaleDateString('pl-PL')}</div>
          </div>
        </div>
      `;
      
      if (improvement > 0) {
        html += `<div style="text-align: center; padding: var(--space-16); background: var(--color-bg-3); border-radius: var(--radius-base); margin-bottom: var(--space-16);">`;
        html += `<i class="fas fa-trophy" style="font-size: 24px; color: var(--color-success); margin-right: var(--space-8);"></i>`;
        html += `<span style="font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);">Poprawa o ${improvementPercent}%! 🎉</span>`;
        html += `</div>`;
      }
      
      html += '<h4 style="margin: var(--space-24) 0 var(--space-16) 0;">Historia wszystkich audytów</h4>';
      html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-16);">';
      
      state.auditHistory.forEach((audit, idx) => {
        const date = new Date(audit.date).toLocaleDateString('pl-PL');
        html += `
          <div style="background: var(--color-bg-1); padding: var(--space-16); border-radius: var(--radius-base); text-align: center;">
            <div style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-bottom: var(--space-8);">Audyt #${idx + 1}</div>
            <div style="font-size: var(--font-size-3xl); font-weight: var(--font-weight-bold); color: var(--color-primary);">${audit.score}%</div>
            <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-4);">${date}</div>
          </div>
        `;
      });
      
      html += '</div></div>';
    }
    
    content.innerHTML = html;
  },
  
  getStatusInfo(score) {
// ... (bez zmian) ...
    if (score >= 85) return { label: 'Świetnie!', color: 'var(--color-success)' };
    if (score >= 70) return { label: 'Dobrze', color: 'var(--color-primary)' };
    if (score >= 50) return { label: 'Do poprawy', color: 'var(--color-warning)' };
    return { label: 'Wymaga uwagi', color: 'var(--color-error)' };
  },
  
  exportReport() {
// ... (bez zmian) ...
    if (state.auditHistory.length === 0) {
      this.showToast('Brak danych do eksportu', 'error');
      return;
    }
    
    const latestAudit = state.auditHistory[state.auditHistory.length - 1];
    let report = '=== RAPORT ERGONOMII - LABORATORIUM ERGONOMII 2.1 ===\n\n';
    report += `Data: ${new Date().toLocaleDateString('pl-PL')}\n\n`;
    report += `Ogólny wynik: ${latestAudit.score}%\n`;
    report += `Status: ${this.getStatusInfo(latestAudit.score).label}\n\n`;
    report += `Plan 10-dniowy: ${state.plan10Days.filter(d => d.completed).length}/10 dni ukończone\n`;
    report += `Ćwiczenia: ${state.completedExercises.length} ukończone\n`;
    report += `Artykuły: ${state.readArticles.length}/${state.articles.length} przeczytane\n`;
    report += `Streak: ${state.streak} dni\n`;
    report += `Punkty: ${state.points}\n`;
    report += `Odznaki: ${state.badges.filter(b => b.unlocked).length}/${state.badges.length}\n\n`;
    
    if (state.auditHistory.length > 1) {
      report += '=== HISTORIA AUDYTÓW ===\n';
      state.auditHistory.forEach((audit, idx) => {
        report += `Audyt #${idx + 1}: ${audit.score}% (${new Date(audit.date).toLocaleDateString('pl-PL')})\n`;
      });
    }
    
    // *** ZMIANA: Użycie document.execCommand('copy') dla lepszej kompatybilności w iframe ***
    const textArea = document.createElement("textarea");
    textArea.value = report;
    textArea.style.position = "fixed";  // Poza ekranem
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        this.showToast('Raport skopiowany do schowka!', 'success');
    } catch (err) {
        this.showToast('Błąd podczas kopiowania', 'error');
    }
    document.body.removeChild(textArea);
  },
  
  renderGamification() {
// ... (bez zmian) ...
    const content = document.getElementById('gamificationContent');
    
    // Determine current level
    const currentLevel = this.getCurrentLevel();
    const nextLevel = this.getNextLevel();
    const platinumThreshold = 1620;
    
    let html = `
      <div class="level-display">
        <div class="level-name">${currentLevel.name}</div>
        <div class="level-points">${state.points} punktów ${state.points >= platinumThreshold ? '(Platinum osiągnięty! 🎉)' : `/ ${platinumThreshold} do Platinum`}</div>
        <p style="margin-top: var(--space-8); color: var(--color-text-secondary);">${currentLevel.description}</p>
      </div>
      
      <div style="background: var(--color-surface); border: 2px solid var(--color-card-border); border-radius: var(--radius-lg); padding: var(--space-24); margin-bottom: var(--space-32);">
        <h3 style="margin-bottom: var(--space-16);"><i class="fas fa-chart-line"></i> System Punktacji</h3>
        <div style="display: grid; gap: var(--space-12); font-size: var(--font-size-sm);">
          <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-1); border-radius: var(--radius-base);">
            <span>Wyzwania (10 dni × 50 pkt)</span>
            <strong>500 pkt</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-2); border-radius: var(--radius-base);">
            <span>Ćwiczenia (20 × 25 pkt)</span>
            <strong>500 pkt</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-3); border-radius: var(--radius-base);">
            <span>Odznaki (8 odznak)</span>
            <strong>~800 pkt</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-12); background: var(--color-bg-5); border-radius: var(--radius-base); font-weight: var(--font-weight-bold); border: 2px solid var(--color-primary);">
            <span>Maksimum (bez quizu)</span>
            <strong>~1800 pkt</strong>
          </div>
          <div style="display: flex; justify-content: space-between; padding: var(--space-8); background: var(--color-bg-7); border-radius: var(--radius-base); opacity: 0.7;">
            <span>Quiz Bonusowy (nie liczy się do Platinum)</span>
            <strong>+500 pkt</strong>
          </div>
        </div>
        <p style="margin-top: var(--space-16); color: var(--color-text-secondary); font-size: var(--font-size-sm); text-align: center;">
          <i class="fas fa-info-circle"></i> Platinum = 1620 pkt (90% pełnej puli bez quizu)
        </p>
      </div>
      
      <div style="margin-bottom: var(--space-32);">
        <h3 style="margin-bottom: var(--space-20);"><i class="fas fa-award"></i> Odznaki</h3>
        <div class="badges-grid">
    `;
    
    state.badges.forEach(badge => {
      html += `
        <div class="badge-card ${badge.unlocked ? 'unlocked' : 'locked'}">
          <div class="badge-icon"><i class="${badge.icon}"></i></div>
          <div class="badge-name">${badge.name}</div>
          <div class="badge-description">${badge.description}</div>
          <div class="badge-points">+${badge.points} pkt</div>
          ${badge.unlocked ? '<div style="margin-top: var(--space-8); color: var(--color-success); font-size: var(--font-size-sm);"><i class="fas fa-check"></i> Odblokowane</div>' : ''}
        </div>
      `;
    });
    
    html += '</div></div>';
    content.innerHTML = html;
  },
  
  getCurrentLevel() {
// ... (bez zmian) ...
    let currentLevel = state.levels[0];
    for (const level of state.levels) {
      if (state.points >= level.minPoints) {
        currentLevel = level;
      }
    }
    return currentLevel;
  },
  
  getNextLevel() {
// ... (bez zmian) ...
    for (const level of state.levels) {
      if (state.points < level.minPoints) {
        return level;
      }
    }
    return null;
  },
  
  // ZMODYFIKOWANA FUNKCJA: checkBadge()
  checkBadge(badgeId) {
    const badge = state.badges.find(b => b.id === badgeId);
    if (badge && !badge.unlocked) {
      badge.unlocked = true;
      this.addPoints(badge.points); // Ta funkcja już zapisuje do Firestore
      this.showBadgeUnlocked(badge);
      // *** ZMIANA: Zapis do Firestore (jest już w addPoints) ***
      // this.saveDataToFirestore(); // Niepotrzebne
    }
  },
  
  showBadgeUnlocked(badge) {
// ... (bez zmian) ...
    this.showToast(`🎉 Odznaka odblokowani: ${badge.name}! +${badge.points} pkt`, 'success');
    this.triggerConfetti();
  },
  
  // ZMODYFIKOWANA FUNKCJA: addPoints()
  addPoints(points) {
    const oldLevel = this.getCurrentLevel();
    const oldPoints = state.points;
    state.points += points;
    const newLevel = this.getCurrentLevel();
    
    // Check if level changed
    if (oldLevel.name !== newLevel.name) {
      this.showToast(`🎉 Awansowałeś na ${newLevel.name}! ${newLevel.description}`, 'success');
      this.triggerConfetti();
    }
    
    // Check if reached Platinum threshold (1620)
    if (oldPoints < 1620 && state.points >= 1620) {
      this.showToast('🎉 PLATINUM! Quiz Bonusowy jest teraz dostępny! 🧠', 'success');
      this.triggerConfetti();
    }
    
    // *** ZMIANA: Zapis do Firestore ***
    this.saveDataToFirestore(); 
    this.updateDashboardKPIs();
  },
  
  // ZMODYFIKOWANA FUNKCJA: updateStreak()
  updateStreak() {
    const today = new Date().toDateString();
    
    if (state.lastActivityDate === today) {
      return; // Already counted today
    }
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (state.lastActivityDate === yesterday.toDateString()) {
      state.streak++;
    } else if (state.lastActivityDate !== today) {
      state.streak = 1; // Resetuj tylko jeśli ostatnia aktywność nie była wczoraj
    }
    
    state.lastActivityDate = today;
    // *** ZMIANA: Zapis do Firestore ***
    this.saveDataToFirestore(); 
  },
  
  showToast(message, type = 'success') {
// ... (bez zmian) ...
    const toast = document.getElementById('toast');
    const icon = type === 'success' ? '<i class="fas fa-check-circle toast-icon"></i>' : '<i class="fas fa-exclamation-circle toast-icon"></i>';
    toast.innerHTML = icon + '<span>' + message + '</span>';
    toast.className = 'toast show toast-' + type;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },
  
  triggerConfetti() {
// ... (bez zmian) ...
    const canvas = document.getElementById('confetti');
    if (!canvas) return; // Zabezpieczenie
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const particles = [];
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10 - 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4
      });
    }
    
    let animationFrameId = null;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3; // gravity
        
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        
        if (p.y > canvas.height) {
          particles.splice(index, 1);
        }
      });
      
      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
          cancelAnimationFrame(animationFrameId);
      }
    };
    
    animate();
  }
};

// ZMODYFIKOWANY EventListener
// Wywołaj inicjalizację po załadowaniu skryptów Firebase
window.addEventListener('load', () => {
    // Sprawdź, czy Firebase jest dostępne
    if (typeof firebase !== 'undefined' && typeof firebase.app === 'function') {
        initializeFirebase();
    } else {
        console.error("Skrypty Firebase nie zostały załadowane. Uruchamianie w trybie offline.");
        app.init(false); // Uruchom w trybie offline
    }

    // Close tooltip when clicking outside
    document.addEventListener('click', (e) => {
        const tooltip = document.getElementById('metricTooltip');
        if (tooltip && tooltip.classList.contains('show')) {
            if (!tooltip.contains(e.target) && !e.target.closest('.metric-info')) {
                app.hideMetricTooltip();
            }
        }
    });
});
