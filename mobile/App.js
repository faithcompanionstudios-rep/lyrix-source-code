
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, FlatList, KeyboardAvoidingView, Platform, Image, Keyboard, Animated, BackHandler, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';

function AppContent() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('schedule');
  const [allSongs, setAllSongs] = useState([]);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tempName, setTempName] = useState('');
  const [currentGreeting, setCurrentGreeting] = useState('Praise the Lord!');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [customAlert, setCustomAlert] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [appVersion, setAppVersion] = useState('1.7.0'); 

  // Connectivity State
  const [desktopIp, setDesktopIp] = useState(null);
  const [isWebRemoteActive, setIsWebRemoteActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasScanned, setHasScanned] = useState(false);

  // Web Search State
  const [isWebSearchOpen, setIsWebSearchOpen] = useState(false);
  const [webSearchQuery, setWebSearchQuery] = useState('');
  const [webSearchResults, setWebSearchResults] = useState([]);
  const [isScraping, setIsScraping] = useState(false);
  
  // Scraper State
  const [scraperUrl, setScraperUrl] = useState(null);
  const [scraperMode, setScraperMode] = useState(null);
  const [scraperScript, setScraperScript] = useState('');
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  const [selectedWebSong, setSelectedWebSong] = useState(null);

  // Animations
  const logoRotate = useRef(new Animated.Value(0)).current;
  const sidebarAnim = useRef(new Animated.Value(-300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const welcomeFadeAnim = useRef(new Animated.Value(0)).current;
  const welcomeScaleAnim = useRef(new Animated.Value(0.9)).current;
  const greetingFadeAnim = useRef(new Animated.Value(0)).current;

  // Data
  const [schedule, setSchedule] = useState([]);
  const [scheduleUpdatedAt, setScheduleUpdatedAt] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const greetings = [
    "Praise the Lord! Welcome Home.",
    "Grace and Peace to you in His Name.",
    "Welcome! May His presence be with you.",
    "Blessings! Rejoice in the Lord always.",
    "He is Good! Welcome to His sanctuary.",
    "Jesus is Lord! Walk in His light today.",
    "Be encouraged! Faith over fear.",
    "Abundant Grace is yours today.",
    "Praise Him! Let your breath be praise.",
    "The Lord is your Shepherd! Rest in Him.",
    "Victory is yours in Jesus Name!",
    "Peace be with you as you worship.",
    "Walking in the Spirit, full of joy!",
    "Hallelujah! Praise be to our King.",
    "His mercies are new for you this morning.",
    "Transformed by Grace, called by Name.",
    "Christ in you, the hope of glory!",
    "Worship Him in Spirit and Truth today.",
    "He is Risen! New life belongs to you.",
    "Let your light shine for His glory.",
    "Be still and know that He is God.",
    "Strength for today, hope for tomorrow.",
    "Greater is He that is in you!",
    "Nothing is impossible with our God!",
    "Rooted and grounded in His perfect love.",
    "The joy of the Lord is your strength!",
    "Blessed to be a blessing to others.",
    "In everything give thanks and rejoice!",
    "Seek Him first, and all will be well.",
    "He who began a good work in you...",
    "Trust in the Lord with all your heart!",
    "His love endurance forever and ever!",
    "You are chosen, holy, and dearly loved!",
    "Come as you are, His arms are open.",
    "Stay encouraged! He is working for you."
  ];

  const bibleVerses = [
    { text: "Enter his gates with thanksgiving and his courts with praise; give thanks to him and praise his name.", ref: "Psalm 100:4" },
    { text: "Great is the Lord and most worthy of praise; his greatness no one can fathom.", ref: "Psalm 145:3" },
    { text: "Let everything that has breath praise the Lord. Praise the Lord.", ref: "Psalm 150:6" },
    { text: "I will praise you, Lord my God, with all my heart; I will glorify your name forever.", ref: "Psalm 86:12" },
    { text: "He is the one you praise; he is your God, who performed for you wonders you saw with your own eyes.", ref: "Deuteronomy 10:21" },
    { text: "I will bless the Lord at all times; his praise shall continually be in my mouth.", ref: "Psalm 34:1" },
    { text: "Sing to the Lord a new song; sing to the Lord, all the earth.", ref: "Psalm 96:1" },
    { text: "Shout for joy to the Lord, all the earth. Worship the Lord with gladness; come before him with joyful songs.", ref: "Psalm 100:1-2" },
    { text: "Praise the Lord. How good it is to sing praises to our God, how pleasant and fitting to praise him!", ref: "Psalm 147:1" },
    { text: "Come, let us sing for joy to the Lord; let us shout aloud to the Rock of our salvation.", ref: "Psalm 95:1" },
    { text: "For the Lord is the great God, the great King above all gods.", ref: "Psalm 95:3" },
    { text: "Come, let us bow down in worship, let us kneel before the Lord our Maker.", ref: "Psalm 95:6" },
    { text: "I will exalt you, my God the King; I will praise your name for ever and ever.", ref: "Psalm 145:1" },
    { text: "Every day I will praise you and extol your name for ever and ever.", ref: "Psalm 145:2" },
    { text: "My soul, praise the Lord; all my inmost being, praise his holy name.", ref: "Psalm 103:1" },
    { text: "Praise the Lord, my soul, and forget not all his benefits.", ref: "Psalm 103:2" },
    { text: "Who forgives all your sins and heals all your diseases.", ref: "Psalm 103:3" },
    { text: "Praise the Lord. Praise the Lord from the heavens; praise him in the heights above.", ref: "Psalm 148:1" },
    { text: "Praise him, all his angels; praise him, all his heavenly hosts.", ref: "Psalm 148:2" },
    { text: "Praise him, sun and moon; praise him, all you shining stars.", ref: "Psalm 148:3" },
    { text: "Let them praise the name of the Lord, for at his command they were created.", ref: "Psalm 148:5" },
    { text: "Let them praise the name of the Lord, for his name alone is exalted; his splendor is above the earth and the heavens.", ref: "Psalm 148:13" },
    { text: "Sing to the Lord a new song, his praise in the assembly of his faithful people.", ref: "Psalm 149:1" },
    { text: "Praise the Lord. Praise God in his sanctuary; praise him in his mighty heavens.", ref: "Psalm 150:1" },
    { text: "Praise him for his acts of power; praise him for his surpassing greatness.", ref: "Psalm 150:2" },
    { text: "Praise him with the sounding of the trumpet, praise him with the harp and lyre.", ref: "Psalm 150:3" },
    { text: "Praise him with timbrel and dancing, praise him with the strings and pipe.", ref: "Psalm 150:4" },
    { text: "Praise him with the clash of cymbals, praise him with resounding cymbals.", ref: "Psalm 150:5" },
    { text: "Because your love is better than life, my lips will glorify you.", ref: "Psalm 63:3" },
    { text: "I will praise you as long as I live, and in your name I will lift up my hands.", ref: "Psalm 63:4" },
    { text: "Praise the Lord, all you servants of the Lord who minister by night in the house of the Lord.", ref: "Psalm 134:1" },
    { text: "Lift up your hands in the sanctuary and praise the Lord.", ref: "Psalm 134:2" },
    { text: "Through Jesus, therefore, let us continually offer to God a sacrifice of praise—the fruit of lips that openly profess his name.", ref: "Hebrews 13:15" },
    { text: "About midnight Paul and Silas were praying and singing hymns to God, and the other prisoners were listening to them.", ref: "Acts 16:25" },
    { text: "Speak to one another with psalms, hymns, and songs from the Spirit. Sing and make music from your heart to the Lord.", ref: "Ephesians 5:19" },
    { text: "Always giving thanks to God the Father for everything, in the name of our Lord Jesus Christ.", ref: "Ephesians 5:20" },
    { text: "Let the message of Christ dwell among you richly... singing to God with gratitude in your hearts.", ref: "Colossians 3:16" },
    { text: "And whatever you do, whether in word or deed, do it all in the name of the Lord Jesus, giving thanks to God the Father through him.", ref: "Colossians 3:17" },
    { text: "Praise be to the God and Father of our Lord Jesus Christ! In his great mercy he has given us new birth into a living hope.", ref: "1 Peter 1:3" },
    { text: "But you are a chosen people... that you may declare the praises of him who called you out of darkness into his wonderful light.", ref: "1 Peter 2:9" },
    { text: "Worthy is the Lamb, who was slain, to receive power and wealth and wisdom and strength and honor and glory and praise!", ref: "Revelation 5:12" },
    { text: "To him who sits on the throne and to the Lamb be praise and honor and glory and power, for ever and ever!", ref: "Revelation 5:13" },
    { text: "You are worthy, our Lord and God, to receive glory and honor and power, for you created all things.", ref: "Revelation 4:11" },
    { text: "Salvation belongs to our God, who sits on the throne, and to the Lamb.", ref: "Revelation 7:10" },
    { text: "Amen! Praise and glory and wisdom and thanks and honor and power and strength be to our God for ever and ever. Amen!", ref: "Revelation 7:12" },
    { text: "Great and marvelous are your deeds, Lord God Almighty. Just and true are your ways, King of the nations.", ref: "Revelation 15:3" },
    { text: "Who will not fear you, Lord, and bring glory to your name? For you alone are holy.", ref: "Revelation 15:4" },
    { text: "For the Lord takes delight in his people; he crowns the humble with victory.", ref: "Psalm 149:4" },
    { text: "I will give thanks to the Lord because of his righteousness; I will sing the praises of the name of the Lord Most High.", ref: "Psalm 7:17" },
    { text: "O Lord, our Lord, how majestic is your name in all the earth!", ref: "Psalm 8:1" },
    { text: "I will sing to the Lord all my life; I will sing praise to my God as long as I live.", ref: "Psalm 104:33" },
    { text: "Give thanks to the Lord, call on his name; make known among the nations what he has done.", ref: "Psalm 105:1" },
    { text: "Sing to him, sing praise to him; tell of all his wonderful acts.", ref: "Psalm 105:2" },
    { text: "Glory in his holy name; let the hearts of those who seek the Lord rejoice.", ref: "Psalm 105:3" },
    { text: "Give thanks to the Lord, for he is good; his love endures forever.", ref: "Psalm 107:1" },
    { text: "Let them give thanks to the Lord for his unfailing love and his wonderful deeds for mankind.", ref: "Psalm 107:8" },
    { text: "He has put a new song in my mouth, a hymn of praise to our God.", ref: "Psalm 40:3" },
    { text: "Seven times a day I praise you for your righteous laws.", ref: "Psalm 119:164" },
    { text: "May my lips overflow with praise, for you teach me your decrees.", ref: "Psalm 119:171" },
    { text: "May my tongue sing of your word, for all your commands are righteous.", ref: "Psalm 119:172" },
    { text: "The Lord is my strength and my shield; my heart trusts in him, and he helps me.", ref: "Psalm 28:7" },
    { text: "My heart leaps for joy, and with my song I praise him.", ref: "Psalm 28:7" },
    { text: "Rejoice in the Lord always. I will say it again: Rejoice!", ref: "Philippians 4:4" },
    { text: "Is anyone among you in trouble? Let them pray. Is anyone happy? Let them sing songs of praise.", ref: "James 5:13" },
    { text: "Sing to the Lord, for he has done glorious things; let this be known to all the world.", ref: "Isaiah 12:5" },
    { text: "Lord, you are my God; I will exalt you and praise your name, for in perfect faithfulness you have done wonderful things.", ref: "Isaiah 25:1" },
    { text: "Ascribe to the Lord the glory due his name; bring an offering and come before him.", ref: "1 Chronicles 16:29" },
    { text: "Worship the Lord in the splendor of his holiness.", ref: "1 Chronicles 16:29" },
    { text: "Let the heavens rejoice, let the earth be glad; let them say among the nations, 'The Lord reigns!'", ref: "1 Chronicles 16:31" },
    { text: "Give thanks to the Lord, for he is good; his love endures forever.", ref: "1 Chronicles 16:34" },
    { text: "Praise be to you, Lord, the God of our father Israel, from everlasting to everlasting.", ref: "1 Chronicles 29:10" },
    { text: "Yours, Lord, is the greatness and the power and the glory and the majesty and the splendor, for everything in heaven and earth is yours.", ref: "1 Chronicles 29:11" },
    { text: "Wealth and honor come from you; you are the ruler of all things.", ref: "1 Chronicles 29:12" },
    { text: "Now, our God, we give you thanks, and praise your glorious name.", ref: "1 Chronicles 29:13" },
    { text: "Stand up and praise the Lord your God, who is from everlasting to everlasting.", ref: "Nehemiah 9:5" },
    { text: "Blessed be your glorious name, and may it be exalted above all blessing and praise.", ref: "Nehemiah 9:5" },
    { text: "You alone are the Lord. You made the heavens, even the highest heavens, and all their starry host.", ref: "Nehemiah 9:6" },
    { text: "All the earth bows down to you; they sing praise to you, they sing the praises of your name.", ref: "Psalm 66:4" },
    { text: "Praise our God, all peoples, let the sound of his praise be heard.", ref: "Psalm 66:8" },
    { text: "This is the day the Lord has made; let us rejoice and be glad in it.", ref: "Psalm 118:24" },
    { text: "The Lord is my strength and my song; he has become my salvation.", ref: "Psalm 118:14" },
    { text: "Give thanks to the Lord, call on his name; make known among the nations what he has done.", ref: "1 Chronicles 16:8" },
    { text: "Sing to him, sing praise to him; tell of all his wonderful acts.", ref: "1 Chronicles 16:9" },
    { text: "Glory in his holy name; let the hearts of those who seek the Lord rejoice.", ref: "1 Chronicles 16:10" },
    { text: "Sing to the Lord, all the earth; proclaim his salvation day after day.", ref: "1 Chronicles 16:23" },
    { text: "Declare his glory among the nations, his marvelous deeds among all peoples.", ref: "1 Chronicles 16:24" },
    { text: "For great is the Lord and most worthy of praise; he is to be feared above all gods.", ref: "1 Chronicles 16:25" },
    { text: "Praise the Lord. Praise the name of the Lord; praise him, you servants of the Lord.", ref: "Psalm 135:1" },
    { text: "Praise the Lord, for the Lord is good; sing praise to his name, for that is pleasant.", ref: "Psalm 135:3" },
    { text: "From the rising of the sun to the place where it sets, the name of the Lord is to be praised.", ref: "Psalm 113:3" },
    { text: "May the glory of the Lord endure forever; may the Lord rejoice in his works.", ref: "Psalm 104:31" },
    { text: "I will sing to the Lord, for he has been good to me.", ref: "Psalm 13:6" },
    { text: "Awake, my soul! Awake, harp and lyre! I will awaken the dawn.", ref: "Psalm 57:8" },
    { text: "I will praise you, Lord, among the nations; I will sing of you among the peoples.", ref: "Psalm 57:9" },
    { text: "For great is your love, reaching to the heavens; your faithfulness reaches to the skies.", ref: "Psalm 57:10" },
    { text: "Be exalted, O God, above the heavens; let your glory be over all the earth.", ref: "Psalm 57:11" },
    { text: "My soul yearns, even faints, for the courts of the Lord; my heart and my flesh cry out for the living God.", ref: "Psalm 84:2" },
    { text: "Better is one day in your courts than a thousand elsewhere.", ref: "Psalm 84:10" },
    { text: "Blessed are those who dwell in your house; they are ever praising you.", ref: "Psalm 84:4" },
    { text: "Holy, holy, holy is the Lord God Almighty, who was, and is, and is to come.", ref: "Revelation 4:8" }
  ];

  const [currentVerse, setCurrentVerse] = useState(bibleVerses[0]);

  useEffect(() => {
    if (customAlert) {
      const timer = setTimeout(() => setCustomAlert(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [customAlert]);

  useEffect(() => {
    if (isSidebarOpen) {
      Animated.loop(
        Animated.timing(logoRotate, { toValue: 1, duration: 4000, useNativeDriver: true })
      ).start();
    } else {
      logoRotate.setValue(0);
    }
  }, [isSidebarOpen]);

  useEffect(() => {
    const initApp = async () => {
      try {
        const savedName = await AsyncStorage.getItem('user_name');
        if (savedName) {
          setUserName(savedName);
          setCurrentGreeting(greetings[Math.floor(Math.random() * greetings.length)]);
          setCurrentVerse(bibleVerses[Math.floor(Math.random() * bibleVerses.length)]);
        } else {
          setShowOnboarding(true);
        }

        const localSongs = await AsyncStorage.getItem('local_songs');
        if (localSongs) setAllSongs(JSON.parse(localSongs));

        const localSchedule = await AsyncStorage.getItem('local_schedule');
        if (localSchedule) setSchedule(JSON.parse(localSchedule));

        const savedIp = await AsyncStorage.getItem('desktop_ip');
        if (savedIp) setDesktopIp(savedIp);

        setIsAuthenticated(true);

        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true })
        ]).start(() => {
          setTimeout(() => {
            Animated.timing(fadeAnim, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
              Animated.parallel([
                Animated.timing(welcomeFadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.spring(welcomeScaleAnim, { toValue: 1, friction: 4, useNativeDriver: true })
              ]).start(() => {
                setTimeout(() => {
                  Animated.timing(welcomeFadeAnim, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
                    setIsAppLoading(false);
                    Animated.timing(greetingFadeAnim, { toValue: 1, duration: 800, delay: 200, useNativeDriver: true }).start();
                  });
                }, 1500);
              });
            });
          }, 1000);
        });
      } catch (e) {
        setIsAppLoading(false);
      }
    };
    initApp();
  }, []);

  useEffect(() => {
    const backAction = () => {
      if (showCategorySelect) {
        setShowCategorySelect(false);
        return true;
      }
      if (isWebSearchOpen) {
        setIsWebSearchOpen(false);
        return true;
      }
      if (isWebRemoteActive) {
        setIsWebRemoteActive(false);
        return true;
      }
      if (isSidebarOpen) {
        toggleSidebar();
        return true;
      }
      BackHandler.exitApp();
      return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [isSidebarOpen, isWebRemoteActive, isWebSearchOpen, showCategorySelect]);

  const toggleSidebar = () => {
    Keyboard.dismiss();
    const toValue = isSidebarOpen ? -310 : 0;
    Animated.timing(sidebarAnim, { toValue, duration: 300, useNativeDriver: true }).start();
    setIsSidebarOpen(!isSidebarOpen);
  };

  const renderFooter = () => (
    <View style={styles.footer}>
      <Text style={styles.footerText}>© Faith Companion Studios | v{appVersion}</Text>
    </View>
  );

  const pushPendingSync = async (ip) => {
      const pending = JSON.parse(await AsyncStorage.getItem('pending_sync_songs') || '[]');
      for (const song of pending) {
          try {
              await fetch(`${ip}/api/add-song`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ songData: song })
              });
          } catch(e) {}
      }
      await AsyncStorage.setItem('pending_sync_songs', '[]');
  };

  const pushScheduleToDesktop = async (currentSchedule, timestamp) => {
    if (!desktopIp) return;
    try {
      const res = await fetch(`${desktopIp}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: currentSchedule, updatedAt: timestamp || scheduleUpdatedAt })
      });
      const json = await res.json();
      if (json.success && json.winner === 'desktop') {
         setSchedule(json.schedule);
         setScheduleUpdatedAt(json.updatedAt);
         AsyncStorage.setItem('local_schedule', JSON.stringify(json.schedule));
         AsyncStorage.setItem('local_schedule_updatedAt', json.updatedAt.toString());
      } else if (json.success && json.winner === 'mobile') {
         setScheduleUpdatedAt(json.updatedAt);
         AsyncStorage.setItem('local_schedule_updatedAt', json.updatedAt.toString());
      }
    } catch(e) {}
  };

  const handleManualSync = async () => {
    if (!desktopIp) {
      setCustomAlert("Connect to desktop to sync.");
      return;
    }
    if (isSidebarOpen) toggleSidebar();
    setIsSyncing(true);
    try {
      await pushPendingSync(desktopIp);
      const res = await fetch(`${desktopIp}/api/songs`);
      const json = await res.json();
      if (json.success) {
         setAllSongs(json.songs);
         await AsyncStorage.setItem('local_songs', JSON.stringify(json.songs));
         await pushScheduleToDesktop(schedule);
         setCustomAlert("Sync Successful! Library updated.");
      }
    } catch (e) {
      setCustomAlert("Sync failed. Check connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSchedule = async () => {
    if (!desktopIp) {
      setCustomAlert("Connect to desktop to sync schedule.");
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fetch(`${desktopIp}/api/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule, updatedAt: scheduleUpdatedAt })
      });
      const json = await res.json();
      if (json.success) {
        setSchedule(json.schedule);
        setScheduleUpdatedAt(json.updatedAt);
        await AsyncStorage.setItem('local_schedule', JSON.stringify(json.schedule));
        await AsyncStorage.setItem('local_schedule_updatedAt', json.updatedAt.toString());
        setCustomAlert(json.winner === 'mobile' ? "Desktop updated from Mobile!" : "Mobile updated from Desktop!");
      }
    } catch (e) {
      setCustomAlert("Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const syncLibrary = async () => {
    if (!desktopIp) {
      setCustomAlert("Connect to desktop to sync database.");
      return;
    }
    if (isSidebarOpen) toggleSidebar();
    try {
      await pushPendingSync(desktopIp);
      const res = await fetch(`${desktopIp}/api/songs`);
      const json = await res.json();
      if (json.success) {
         setAllSongs(json.songs);
         await AsyncStorage.setItem('local_songs', JSON.stringify(json.songs));
         setCustomAlert("Database Sync Successful!");
      }
    } catch (e) {
      setCustomAlert("Database Sync failed.");
    }
  };

  const addToSchedule = async (songId) => {
    if (schedule.some(item => item.songId === songId)) {
      setCustomAlert("Already in schedule.");
      return;
    }
    const song = allSongs.find(s => s.id === songId);
    if (!song) return;

    const newItem = {
      instanceId: Date.now().toString(),
      songId: song.id,
      title: song.title || "Unknown",
      category: song.category || "General"
    };

    const newSchedule = [...schedule, newItem];
    const newTimestamp = Date.now();
    setSchedule(newSchedule);
    setScheduleUpdatedAt(newTimestamp);
    await AsyncStorage.setItem('local_schedule', JSON.stringify(newSchedule));
    await AsyncStorage.setItem('local_schedule_updatedAt', newTimestamp.toString());
    setActiveTab('schedule');
    pushScheduleToDesktop(newSchedule, newTimestamp);
  };

  const removeFromSchedule = async (instanceId) => {
    const newSchedule = schedule.filter(i => i.instanceId !== instanceId);
    const newTimestamp = Date.now();
    setSchedule(newSchedule);
    setScheduleUpdatedAt(newTimestamp);
    await AsyncStorage.setItem('local_schedule', JSON.stringify(newSchedule));
    await AsyncStorage.setItem('local_schedule_updatedAt', newTimestamp.toString());
    pushScheduleToDesktop(newSchedule, newTimestamp);
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (hasScanned) return;
    if (data.includes('http://') && data.includes(':3001')) {
      setHasScanned(true);
      setCustomAlert("Connecting to Desktop...");
      try {
        await pushPendingSync(data);
        const res = await fetch(`${data}/api/songs`);
        const json = await res.json();
        if (json.success) {
          setAllSongs(json.songs);
          await AsyncStorage.setItem('local_songs', JSON.stringify(json.songs));
          setDesktopIp(data);
          await AsyncStorage.setItem('desktop_ip', data);
          
          const schedRes = await fetch(`${data}/api/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schedule, updatedAt: scheduleUpdatedAt })
          });
          const schedJson = await schedRes.json();
          if (schedJson.success) {
             setSchedule(schedJson.schedule);
             setScheduleUpdatedAt(schedJson.updatedAt);
             await AsyncStorage.setItem('local_schedule', JSON.stringify(schedJson.schedule));
             await AsyncStorage.setItem('local_schedule_updatedAt', schedJson.updatedAt.toString());
          }
          
          setIsWebRemoteActive(true);
        }
      } catch (e) {
        setCustomAlert("Connection failed. Check Wi-Fi.");
      } finally {
        setTimeout(() => setHasScanned(false), 3000);
      }
    } else {
      setHasScanned(true);
      setCustomAlert("Invalid LyriX QR Code");
      setTimeout(() => setHasScanned(false), 3000);
    }
  };

  // NATIVE WEB SCRAPER LOGIC
  const handleWebSearch = () => {
    if (!webSearchQuery.trim()) return;
    Keyboard.dismiss();
    setIsScraping(true);
    setWebSearchResults([]);
    setScraperMode('search');
    setScraperUrl(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(webSearchQuery + ' lyrics')}`);
    setScraperScript(`
      setTimeout(() => {
          const items = [];
          document.querySelectorAll('.result').forEach(el => {
            const titleEl = el.querySelector('.result__title a, .result__a');
            const snippetEl = el.querySelector('.result__snippet');
            if (titleEl && titleEl.href.includes('http')) {
              items.push({
                title: (titleEl.textContent || '').trim(),
                url: titleEl.href,
                snippet: snippetEl ? (snippetEl.textContent || '').trim() : ''
              });
            }
          });
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'search', data: items.slice(0, 15) }));
      }, 1000);
      true;
    `);
  };

  const saveWebSong = (url, title) => {
    setSelectedWebSong({ url, title });
    setShowCategorySelect(true);
  };

  const executeSaveWebSong = (category) => {
    setShowCategorySelect(false);
    setCustomAlert("Extracting Lyrics...");
    setIsScraping(true);
    setScraperMode('extract');
    setScraperUrl(selectedWebSong.url);
    setSelectedWebSong({ ...selectedWebSong, category });
    setScraperScript(`
      setTimeout(() => {
          try {
              ['script', 'style', 'nav', 'header', 'footer', 'iframe', 'img', 'svg', 'button', 'form', 'aside', '.ads', '[role="navigation"]', 'meta', 'link'].forEach(tag => {
                  document.querySelectorAll(tag).forEach(el => el.remove());
              });
              
              let container = null;
              const exactSelectors = ['[data-lyrics-container="true"]', '.lyrics', '.lyricbox', '.lyrics-body', '#lyric-body-text', '.ringtone'];
              for (let selector of exactSelectors) {
                  const el = document.querySelector(selector);
                  if (el) { container = el; break; }
              }
              
              if (!container || container.innerText.length < 50) {
                  let maxScore = -1;
                  let bestEl = null;
                  document.querySelectorAll('div, p, article, section').forEach(el => {
                      const brCount = el.querySelectorAll('br').length;
                      if (brCount > 3) {
                          const linkLen = Array.from(el.querySelectorAll('a')).reduce((acc, a) => acc + (a.innerText || '').length, 0);
                          const totalLen = el.innerText.length || 1;
                          const linkRatio = linkLen / totalLen;
                          if (linkRatio < 0.4) {
                              const score = brCount * (1 - linkRatio);
                              if (score > maxScore) { maxScore = score; bestEl = el; }
                          }
                      }
                  });
                  if (bestEl) container = bestEl;
              }
              if (!container) container = document.body;
              
              container.querySelectorAll('br').forEach(br => br.replaceWith('__BR__'));
              container.querySelectorAll('p, div').forEach(p => p.append('__BR__'));
              let text = container.innerText.replace(/__BR__/g, '\\n');
              
              const slides = text.split('\\n').map(l => l.trim()).reduce((acc, line) => {
                  const last = acc[acc.length - 1];
                  if (!line) { if (acc.length > 0 && last !== '') acc.push(''); }
                  else { acc.push(line); }
                  return acc;
              }, []).join('\\n').substring(0, 10000);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'extract', data: slides }));
          } catch(e) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', data: e.message }));
          }
      }, 2500);
      true;
    `);
  };

  const getNextId = (category) => {
      const prefixMap = { 'English': 'E', 'Telugu': 'T', 'Hindi': 'H', 'Sunday School': 'S', 'Worship': 'W', 'Special': 'X' };
      const prefix = prefixMap[category] || category.charAt(0).toUpperCase();
      let maxNum = 0;
      allSongs.forEach(s => {
          if (s.id && s.id.startsWith(prefix)) {
              const numPart = s.id.substring(prefix.length);
              if (/^\d+$/.test(numPart)) {
                  maxNum = Math.max(maxNum, parseInt(numPart, 10));
              }
          }
      });
      return prefix + (maxNum + 1);
  };

  const handleScraperMessage = async (event) => {
      try {
          const result = JSON.parse(event.nativeEvent.data);
          if (result.type === 'search') {
              setWebSearchResults(result.data);
              setIsScraping(false);
              setScraperMode(null);
          } else if (result.type === 'extract') {
              const slidesStr = result.data || '';
              const slides = slidesStr.split('\n\n').map(s => s.trim()).filter(Boolean);
              if (slides.length === 0) {
                  setCustomAlert("Failed to extract lyrics.");
                  setIsScraping(false);
                  setScraperMode(null);
                  return;
              }

              const newId = getNextId(selectedWebSong.category);
              const newSong = {
                  id: newId,
                  title: selectedWebSong.title,
                  category: selectedWebSong.category,
                  slides: slides,
                  searchKey: selectedWebSong.title.toLowerCase()
              };

              const newAllSongs = [...allSongs, newSong];
              setAllSongs(newAllSongs);
              await AsyncStorage.setItem('local_songs', JSON.stringify(newAllSongs));

              const pending = JSON.parse(await AsyncStorage.getItem('pending_sync_songs') || '[]');
              pending.push(newSong);
              await AsyncStorage.setItem('pending_sync_songs', JSON.stringify(pending));

              if (desktopIp) pushPendingSync(desktopIp); // Sync immediately if connected

              setCustomAlert("Song Added to Local Library!");
              setIsScraping(false);
              setScraperMode(null);
              setIsWebSearchOpen(false); 
          } else if (result.type === 'error') {
              setCustomAlert("Scraping error: " + result.data);
              setIsScraping(false);
              setScraperMode(null);
          }
      } catch(e) {
          setIsScraping(false);
          setScraperMode(null);
      }
  };

  const renderSearch = () => {
    const handleLocalSearch = () => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) { setSearchResults([]); return; }
      const res = allSongs.filter(s => 
         (s.title || '').toLowerCase().includes(q) || 
         (s.id || '').toString().toLowerCase().includes(q) ||
         (s.slides || []).join(' ').toLowerCase().includes(q)
      ).slice(0, 50);
      setSearchResults(res);
    };

    return (
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image source={require('./assets/branding_logo.png')} style={styles.logo} />
        </View>
        <Text style={styles.heading}>Search Local Database ({allSongs.length})</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={(t) => { setSearchQuery(t); handleLocalSearch(); }}
          />
        </View>
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title || item.displayTitle}</Text>
                <Text style={styles.itemSubtitle}>{item.category} • {item.id}</Text>
              </View>
              <TouchableOpacity style={styles.addButton} onPress={() => addToSchedule(item.id)}>
                <Text style={styles.addButtonText}>Add +</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No results.</Text>}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    );
  };

  const renderConnect = () => (
    <ScrollView style={styles.content} contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}>
      <View style={styles.logoContainer}>
          <Image source={require('./assets/branding_logo.png')} style={styles.logo} />
      </View>
      <Text style={styles.heading}>Connect to Desktop</Text>
      <Text style={styles.label}>Scan the QR Code on the LyriX Projector window to sync and control.</Text>
      
      <View style={{ width: 280, height: 280, alignSelf: 'center', borderRadius: 24, overflow: 'hidden', marginTop: 20, marginBottom: 40, backgroundColor: 'black', borderWidth: 1, borderColor: '#374151' }}>
         {!permission?.granted ? (
             <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
                 <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
                     <Text style={styles.primaryButtonText}>Enable Camera</Text>
                 </TouchableOpacity>
             </View>
         ) : (
             <CameraView 
                style={{ flex: 1 }} 
                facing="back"
                onBarcodeScanned={handleBarcodeScanned}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
             />
         )}
      </View>

      {desktopIp && (
        <View style={{marginBottom: 40, width: 250, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, alignSelf: 'center'}}>
           <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#10b981', flex: 1, height: 48, paddingVertical: 0, justifyContent: 'center', marginTop: 0, marginBottom: 0 }]} onPress={() => setIsWebRemoteActive(true)}>
               <Text style={[styles.primaryButtonText, { fontSize: 12 }]}>LAUNCH REMOTE</Text>
               <Text style={{color:'white', fontSize: 9}}>{desktopIp}</Text>
           </TouchableOpacity>
           <TouchableOpacity onPress={() => { setIsWebRemoteActive(false); setDesktopIp(null); AsyncStorage.removeItem('desktop_ip'); }} style={{width: 48, height: 48, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center', justifyContent: 'center'}}>
               <Ionicons name="power" size={24} color="#ef4444" />
           </TouchableOpacity>
        </View>
      )}
      
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      </View>
    </ScrollView>
  );

  const BottomTabs = useMemo(() => (
    <View style={[styles.tabContainer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab]} onPress={() => setActiveTab('schedule')}>
          <Ionicons name={activeTab === 'schedule' ? "list" : "list-outline"} size={28} color={activeTab === 'schedule' ? "#6366f1" : "#9ca3af"} />
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab]} onPress={() => setActiveTab('connect')}>
          <View style={styles.addIconContainer}>
            <Ionicons name="qr-code" size={26} color="white" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab]} onPress={() => setActiveTab('search')}>
          <Ionicons name={activeTab === 'search' ? "search" : "search-outline"} size={28} color={activeTab === 'search' ? "#6366f1" : "#9ca3af"} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [activeTab, insets.bottom]);

  const renderSidebar = () => (
    <>
      {isSidebarOpen && <TouchableOpacity style={styles.sidebarOverlay} activeOpacity={1} onPress={toggleSidebar} />}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: sidebarAnim }] }]}>
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarLogoGlowContainer}>
            <Animated.View style={[styles.logoGlow, { transform: [{ rotate: logoRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]} />
            <Image source={require('./assets/branding_logo.png')} style={styles.sidebarLogo} />
          </View>
          <Text style={styles.sidebarTitleItalic}>LyriX Remote</Text>
        </View>
        <View style={styles.sidebarContent}>
          <Text style={styles.sidebarLabel}>Your Name</Text>
          <TextInput style={[styles.sidebarInput, { marginBottom: 20 }]} value={userName} onChangeText={(t) => { setUserName(t); AsyncStorage.setItem('user_name', t); }} placeholder="Friend" placeholderTextColor="#666" />
          
          <View style={{flexDirection: 'row', gap: 12, marginTop: 24}}>
              <TouchableOpacity style={{flex: 1, backgroundColor: 'rgba(99, 102, 241, 0.1)', borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center'}} onPress={() => { toggleSidebar(); setIsWebSearchOpen(true); }}>
                  <Ionicons name="globe" size={28} color="#818cf8" style={{marginBottom: 8}} />
                  <Text style={{color: '#818cf8', fontWeight: 'bold', fontSize: 13}}>Web Search</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={{flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center'}} onPress={syncLibrary}>
                  <Ionicons name="sync" size={28} color="#34d399" style={{marginBottom: 8}} />
                  <Text style={{color: '#34d399', fontWeight: 'bold', fontSize: 13}}>Sync</Text>
              </TouchableOpacity>
          </View>

        </View>
        <View style={styles.sidebarFooter}>
            <Text style={{color: '#4b5563', fontSize: 12, fontStyle: 'italic', marginBottom: 16, textAlign: 'center'}}>Songs: {allSongs.length} in library</Text>

            
            <Text style={{color: '#4b5563', fontSize: 10, textAlign: 'center', fontWeight: 'bold'}}>© Faith Companion Studios</Text>
        </View>
      </Animated.View>
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: 0 }]}>
      {isAppLoading ? (
        <View style={styles.splashContainer}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}>
            <Image source={require('./assets/branding_logo.png')} style={styles.splashLogo} />
            <Text style={styles.splashBranding}>LYRIX</Text>
          </Animated.View>
          <Animated.View style={{ opacity: welcomeFadeAnim, transform: [{ scale: welcomeScaleAnim }], alignItems: 'center', position: 'absolute', width: '100%', paddingHorizontal: 20 }}>
            <Text style={styles.welcomeTitle}>{currentGreeting}</Text>
            <Text style={styles.welcomeName}>{userName}</Text>
          </Animated.View>
        </View>
      ) : showOnboarding ? (
        <View style={styles.onboardingContainer}>
          <Image source={require('./assets/branding_logo.png')} style={styles.onboardingLogo} />
          <Text style={styles.onboardingTitle}>Welcome to LyriX</Text>
          <TextInput style={styles.onboardingInput} placeholder="Your Name" placeholderTextColor="#6b7280" value={tempName} onChangeText={setTempName} autoFocus />
          <TouchableOpacity style={styles.primaryButton} onPress={() => { AsyncStorage.setItem('user_name', tempName); setUserName(tempName); setShowOnboarding(false); setIsAppLoading(true); setTimeout(()=>setIsAppLoading(false),500); }}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      ) : isWebRemoteActive && desktopIp ? (
          <>
              {Platform.OS === 'web' ? (
                  <iframe src={desktopIp.startsWith('http') ? `${desktopIp}/?theme=dark&mobile_app=true` : `http://${desktopIp}/?theme=dark&mobile_app=true`} style={{ flex: 1, width: '100%', height: '100%', border: 'none' }} />
              ) : (
                  <WebView 
                      source={{ uri: desktopIp.startsWith('http') ? `${desktopIp}/?theme=dark&mobile_app=true` : `http://${desktopIp}/?theme=dark&mobile_app=true` }} 
                      style={{ flex: 1, backgroundColor: '#111827' }} 
                      javaScriptEnabled={true}
                      injectedJavaScript={`
                          document.documentElement.style.setProperty('--bg-color', '#111827');
                          document.documentElement.style.setProperty('--surface-color', '#1f2937');
                          document.documentElement.style.setProperty('--text-primary', '#f8fafc');
                          document.documentElement.style.setProperty('--text-secondary', '#9ca3af');
                          document.documentElement.style.setProperty('--border-color', '#374151');
                          document.documentElement.style.setProperty('color-scheme', 'dark');
                          const header = document.querySelector('.header');
                          if(header) header.style.display = 'none';
                          const hamburgerBtn = document.getElementById('hamburgerBtn');
                          if(hamburgerBtn) hamburgerBtn.style.display = 'none';
                          const style = document.createElement('style');
                          style.textContent = '.btn-blank:not(.active-blank) { color: #1e293b !important; }';
                          document.head.appendChild(style);
                          const prevBtns = document.querySelectorAll('.btn-prev');
                          prevBtns.forEach(btn => { 
                              btn.style.backgroundColor = '#1f2937'; 
                              btn.style.color = '#f8fafc'; 
                              btn.style.borderColor = '#374151';
                          });
                          true;
                      `}
                  />
              )}
          </>
      ) : (
        <>
          {(!isSidebarOpen && !isWebSearchOpen) && <TouchableOpacity style={styles.hamburgerButton} onPress={toggleSidebar}><Ionicons name="menu" size={32} color="white" /></TouchableOpacity>}
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            {activeTab === 'schedule' && (
                <View style={styles.content}>
                  <View style={styles.logoContainer}><Image source={require('./assets/branding_logo.png')} style={styles.logo} /></View>
                  <Animated.View style={[styles.welcomeBanner, { opacity: greetingFadeAnim, transform: [{ translateY: greetingFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                    <Text style={styles.verseText}>{currentVerse.text}</Text><Text style={styles.verseRef}>{currentVerse.ref}</Text>
                  </Animated.View>
                  <View style={styles.headerRow}>
                    <Text style={styles.heading}>Local Schedule</Text>
                    <View style={styles.headerActions}>
                      {isSyncing ? (
                        <ActivityIndicator size="small" color="#818cf8" style={{ marginRight: 12 }} />
                      ) : (
                        <TouchableOpacity onPress={syncSchedule} style={{marginRight: 12}}>
                          <Ionicons name="sync-outline" size={24} color="#818cf8" />
                        </TouchableOpacity>
                      )}
                      <View style={styles.countBadge}><Text style={styles.countBadgeText}>{schedule.length}</Text></View>
                    </View>
                  </View>
                  <FlatList
                    data={schedule}
                    keyExtractor={(item) => item.instanceId}
                    renderItem={({ item, index }) => (
                      <View style={styles.listItem}>
                        <View style={styles.itemMain}>
                          <Text style={styles.itemIndex}>{index + 1}</Text>
                          <View style={{ flex: 1 }}><Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text><Text style={styles.itemSubtitle}>{item.category} • {item.songId}</Text></View>
                        </View>
                        <TouchableOpacity onPress={() => removeFromSchedule(item.instanceId)} style={styles.deleteButton}>
                            <Ionicons name="trash-outline" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                      </View>
                    )}
                    ListEmptyComponent={<Text style={styles.emptyText}>Schedule is empty.</Text>}
                    contentContainerStyle={{ paddingBottom: 20 }}
                  />
                </View>
            )}
            {activeTab === 'connect' && renderConnect()}
            {activeTab === 'search' && renderSearch()}
            {renderFooter()}
          </KeyboardAvoidingView>
          {!isKeyboardVisible && BottomTabs}
          {renderSidebar()}
        </>
      )}

      {isWebSearchOpen && (
             <View style={[styles.modalOverlay, {backgroundColor: '#111827', zIndex: 1005, padding: 0, justifyContent: 'flex-start'}]}>
                                   <View style={{flexDirection: 'row', alignItems: 'center', padding: 24, paddingTop: Platform.OS==='android'? 60:40, backgroundColor: '#111827'}}>
                      <TouchableOpacity onPress={() => setIsWebSearchOpen(false)} style={{backgroundColor: 'rgba(255,255,255,0.05)', padding: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'}}>
                          <Ionicons name="chevron-back" size={24} color="white" />
                      </TouchableOpacity>
                      <View style={{marginLeft: 20}}>
                        <Text style={{color: 'white', fontSize: 32, fontWeight: '900', letterSpacing: 0.5}}>Discover</Text>
                        <Text style={{color: '#818cf8', fontSize: 12, fontWeight: 'bold', letterSpacing: 2, marginTop: 4, textTransform: 'uppercase'}}>Web Lyrics Search</Text>
                      </View>
                  </View>
                  <View style={{padding: 20, flex: 1}}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#374151', marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 15 }}>
                          <View style={{paddingHorizontal: 12}}>
                             <Ionicons name="search" size={24} color="#818cf8" />
                          </View>
                          <TextInput style={{flex: 1, color: 'white', fontSize: 18, fontWeight: '600', fontStyle: 'italic', paddingVertical: 10}} placeholder="Search internet for lyrics..." placeholderTextColor="#6b7280" value={webSearchQuery} onChangeText={setWebSearchQuery} onSubmitEditing={handleWebSearch} />
                          <TouchableOpacity style={{backgroundColor: '#6366f1', padding: 16, borderRadius: 16, marginLeft: 8}} onPress={handleWebSearch}>
                              {isScraping ? <ActivityIndicator color="white" size="small" /> : <Ionicons name="arrow-forward" size={20} color="white" />}
                          </TouchableOpacity>
                      </View>
                      <FlatList
                          data={webSearchResults}
                          keyExtractor={(item, idx) => idx.toString()}
                          renderItem={({ item, index }) => (
                              <View style={{flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 20, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'}}>
                                  <View style={{width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16}}>
                                      <Text style={{color: '#818cf8', fontWeight: '900', fontSize: 16}}>{index + 1}</Text>
                                  </View>
                                  <View style={{ flex: 1, paddingRight: 12 }}>
                                      <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16, marginBottom: 4}} numberOfLines={1}>{item.title}</Text>
                                      <Text style={{color: '#9ca3af', fontSize: 13, lineHeight: 18}} numberOfLines={2}>{item.snippet}</Text>
                                  </View>
                                  <TouchableOpacity style={{backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)'}} onPress={() => saveWebSong(item.url, item.title)}>
                                      <Text style={{color: '#34d399', fontWeight: '900', fontSize: 14, textTransform: 'uppercase'}}>Get</Text>
                                  </TouchableOpacity>
                              </View>
                          )}
                          ListEmptyComponent={
                              <View style={{alignItems: 'center', justifyContent: 'center', marginTop: 100, opacity: 0.8}}>
                                  <View style={{width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(99,102,241,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 24}}>
                                      <Ionicons name="globe-outline" size={48} color="#6366f1" />
                                  </View>
                                  <Text style={{color: 'white', fontSize: 24, fontWeight: '900'}}>Ready to Explore</Text>
                                  <Text style={{color: '#9ca3af', textAlign: 'center', marginTop: 12, paddingHorizontal: 40, fontSize: 16, lineHeight: 24}}>Type a song name, lyrics, or artist to search the web and import it directly into your library.</Text>
                              </View>
                          }
                      />
                 </View>
             </View>
      )}

      {showCategorySelect && (
         <View style={[styles.modalOverlay, { zIndex: 2005 }]}>
             <View style={{ backgroundColor: '#1f2937', padding: 20, borderRadius: 10, width: '80%', maxHeight: '70%' }}>
                 <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 }}>Select Category</Text>
                 <ScrollView>
                     {['English', 'Telugu', 'Hindi', 'Sunday School', 'Worship', 'Special'].map(cat => (
                         <TouchableOpacity key={cat} onPress={() => executeSaveWebSong(cat)} style={{ padding: 15, borderBottomWidth: 1, borderColor: '#374151' }}>
                             <Text style={{ color: 'white', fontSize: 16 }}>{cat}</Text>
                         </TouchableOpacity>
                     ))}
                 </ScrollView>
                 <TouchableOpacity onPress={() => setShowCategorySelect(false)} style={{ marginTop: 15, alignItems: 'center', padding: 10 }}>
                     <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Cancel</Text>
                 </TouchableOpacity>
             </View>
         </View>
      )}

      {customAlert && (
        <View style={{ position: 'absolute', top: 60, width: '100%', alignItems: 'center', zIndex: 20000, paddingHorizontal: 20 }}>
          <View style={[styles.customAlertContainer, { flexDirection: 'row', backgroundColor: '#1f2937', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#374151', width: '100%', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 10 }]}>
            <Ionicons name="notifications" size={24} color="#818cf8" style={{ marginRight: 12 }} />
            <Text style={[styles.alertText, { color: 'white', flex: 1, fontWeight: 'bold' }]}>{customAlert}</Text>
          </View>
        </View>
      )}

      {scraperMode && scraperUrl && (
          <View style={{ position: 'absolute', width: 0, height: 0, opacity: 0 }}>
              <WebView 
                  source={{ uri: scraperUrl }}
                  injectedJavaScript={scraperScript}
                  onMessage={handleScraperMessage}
                  javaScriptEnabled={true}
              />
          </View>
      )}

    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827', paddingTop: Platform.OS === 'android' ? 45 : 0 }, // Added top safe area
  centerContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', padding: 20 },

  content: { flex: 1, padding: 16 },

  title: { fontSize: 28, color: 'white', fontWeight: 'bold', textAlign: 'center', marginBottom: 30 },
  label: { color: '#9ca3af', marginBottom: 8, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: '#1f2937',
    color: 'white',
    padding: 18,
    borderRadius: 16,
    marginBottom: 24,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151'
  },
  hint: { color: '#6b7280', textAlign: 'center', marginTop: 24 },
  debugText: { color: '#4b5563', textAlign: 'center', fontSize: 12, marginBottom: 12 },

  primaryButton: {
    backgroundColor: '#6366f1', // Indigo-500
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 4,
    marginTop: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  primaryButtonText: { color: 'white', fontWeight: '800', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },

  secondaryButton: {
    backgroundColor: '#374151',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4b5563'
  },
  secondaryButtonText: { color: '#e5e7eb', fontWeight: 'bold' },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  status: { color: '#4ade80', fontWeight: 'bold' },
  heading: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },

  controlGrid: { flexDirection: 'row', gap: 16, marginBottom: 16, height: 160 },
  bigButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  bigButtonText: { color: 'white', fontSize: 20, fontWeight: '900' },

  actionButton: { backgroundColor: '#374151', padding: 20, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  blackoutButton: { backgroundColor: '#dc2626' },
  actionButtonText: { color: 'white', fontWeight: 'bold' },

  // New Branding & Onboarding Styles
  splashContainer: { flex: 1, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  splashLogo: { width: 120, height: 120, resizeMode: 'contain', marginBottom: 20 },
  splashBranding: { color: 'white', fontSize: 32, fontWeight: '900', letterSpacing: 8, marginBottom: 10, textAlign: 'center' },
  splashSlogan: { color: '#6366f1', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center' },

  logoGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6366f1',
    opacity: 0.15,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
    zIndex: 1
  },

  onboardingContainer: { flex: 1, backgroundColor: '#111827', padding: 30, justifyContent: 'center' },
  onboardingLogo: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 24, alignSelf: 'center' },
  onboardingTitle: { color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  onboardingSubtitle: { color: '#9ca3af', fontSize: 16, textAlign: 'center', marginBottom: 40 },
  onboardingInput: {
    backgroundColor: '#1f2937',
    color: 'white',
    padding: 18,
    borderRadius: 16,
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 24,
    textAlign: 'center'
  },

  welcomeBanner: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 30,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3
  },
  verseText: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20
  },
  userNameField: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4
  },
  statusText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500'
  },
  sidebarSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 6
  },
  sidebarSyncText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  verseRef: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic'
  },
  welcomeTitle: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center'
  },
  welcomeName: {
    color: 'white',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center'
  },
  logoContainer: { alignItems: 'center', marginBottom: 20, paddingTop: 40 },
  logo: { width: 80, height: 80, resizeMode: 'contain', marginBottom: 12 },
  brandingText: { color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  brandingTextItalic: { color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: 2, fontStyle: 'italic' },
  headerLogoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingTop: 10 },
  headerLogo: { width: 32, height: 32, resizeMode: 'contain' },
  tabContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: 'center',
    backgroundColor: '#111827'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 30,
    height: 60,
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tab: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  activeTab: {},
  tabText: { color: '#9ca3af', fontSize: 10, marginTop: 2, fontWeight: 'bold' },
  activeTabText: { color: '#6366f1', fontWeight: 'bold' },
  addIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    // Removed marginBottom to align with other tabs
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5
  },

  // List Styles
  listItem: { flexDirection: 'row', backgroundColor: '#1f2937', padding: 16, borderRadius: 12, marginBottom: 8, alignItems: 'center' },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  itemIndex: { color: '#6b7280', fontWeight: 'bold', marginRight: 12, width: 24 },
  itemTitle: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  itemSubtitle: { color: '#9ca3af', fontSize: 14, marginTop: 4 },

  deleteButton: { padding: 8 },
  deleteText: { fontSize: 20 },
  debugTextSub: { color: '#4b5563', fontSize: 10, marginTop: 2 },

  addButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80
  },
  addButtonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },

  searchRow: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#1f2937',
    borderRadius: 30, // Pill shape like bottom bar
    paddingHorizontal: 20,
    paddingVertical: 5,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#374151'
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: 'white',
    paddingVertical: 15, // Taller touch area
    fontSize: 18,
    fontWeight: 'bold'
  },
  goButton: {
    backgroundColor: '#6366f1',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10
  },
  emptyText: { color: '#6b7280', textAlign: 'center', marginTop: 40 },
  footer: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5
  },

  // Sidebar Styles
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 300,
    backgroundColor: '#1f2937',
    zIndex: 1000,
    padding: 24,
    borderRightWidth: 1,
    borderRightColor: '#374151',
    shadowColor: "#000",
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 999,
  },
  hamburgerButton: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 60 : 20, // Adjusted for safe area
    left: 20,
    zIndex: 10000, // Higher Z-index
    padding: 12,
    backgroundColor: 'rgba(31, 41, 55, 0.9)', // Slightly more opaque
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  sidebarHeader: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 50, // Move logo down in sidebar
  },
  sidebarLogo: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    zIndex: 2,
  },
  sidebarLogoGlowContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    width: 90,
    height: 90
  },
  sidebarTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 4,
  },
  sidebarTitleItalic: {
    color: 'white',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1
  },
  sidebarContent: {
    flex: 1,
  },
  sidebarLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sidebarInput: {
    backgroundColor: '#111827',
    color: 'white',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 32,
  },
  sidebarStatusContainer: {
    marginTop: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  sidebarFooter: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    alignItems: 'center',
  },
  sidebarFooterText: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },

  // Custom Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    padding: 24,
  },
  customAlertContainer: {
    backgroundColor: 'white',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 20,
  },
  alertIconBg: {
    width: 64,
    height: 64,
  },
  alertButton: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center'
  },
  countBadgeText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '900'
  },
});
