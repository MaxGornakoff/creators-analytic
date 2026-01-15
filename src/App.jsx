import { useState, useEffect } from 'react';
import WebApp from '@twa-dev/sdk';
import logo from './assets/logo2.png';
import './App.css';

const BACKEND_URL = 'https://creators-analytic-backend.onrender.com';

function App() {
  const [forms, setForms] = useState([{ id: 1, url: '', category: '', urlError: '', categoryError: '' }]);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [accountCategories, setAccountCategories] = useState([]);
  const [isAuthFailed, setIsAuthFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [user, setUser] = useState(null); 
  const [activeTab, setActiveTab] = useState('user'); 

  const [newUser, setNewUser] = useState({
    telegram_id: '',
    username: '',
    name_soname: '',
    accounts: [{ account_name: '', social_network: 'Instagram', username_at: '' }]
  });

  const [adminErrors, setAdminErrors] = useState({});
  const [openSections, setOpenSections] = useState({
    registration: true, 
    teamList: false,
    analytics: false
  });

  const [teamData, setTeamData] = useState([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);
  
  const [syncLogs, setSyncLogs] = useState('Нажмите кнопку для начала сбора...');
  const [isSyncing, setIsSyncing] = useState(false);

  // Исправлено: объединил логику получения команды для стабильности
 const fetchTeamActivity = async () => {
    setIsTeamLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/admin/get_full_team_data`, {
        method: 'GET',
        headers: {
          'Authorization': `twa-init-data ${WebApp.initData}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Сохраняем массив members из ответа бэкенда
        setTeamData(data.members || []);
      }
    } catch (e) {
      console.error("Ошибка загрузки аналитики:", e);
    } finally {
      setIsTeamLoading(false);
    }
  };

  const toggleSection = (section) => {
    const isOpening = !openSections[section];
    setOpenSections(prev => ({ ...prev, [section]: isOpening }));
    if (section === 'teamList' && isOpening) {
      fetchTeamActivity();
    }
    if (section === 'analytics' && isOpening) {
    fetchLogs(); 
    }
  };

  const fetchUserData = async () => {
    const initData = WebApp.initData;
    setIsLoading(true); // Начинаем загрузку

    try {
      const authResponse = await fetch(`${BACKEND_URL}/auth`, {
        method: 'POST',
        headers: {
          'Authorization': `twa-init-data ${initData}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (!authResponse.ok) {
        if (authResponse.status === 403) {
          setIsAuthFailed(true);
        } else {
          const errorData = await authResponse.json();
          WebApp.showAlert(`Ошибка: ${errorData.detail || authResponse.statusText}`);
        }
        setIsLoading(false);
        return;
      }

      const authData = await authResponse.json();
      setUser(authData.user); 

      // Если авторизован, грузим категории
      const accountsResponse = await fetch(`${BACKEND_URL}/accounts_list`, {
        method: 'GET',
        headers: {
          'Authorization': `twa-init-data ${initData}`,
          'ngrok-skip-browser-warning': 'true'
        }
      });
      
      if (accountsResponse.ok) {
        const accountsList = await accountsResponse.json();
        setAccountCategories(accountsList); 
      }
      
    } catch (error) {
      console.error("Fetch error:", error);
      // Для тестов на ПК, если бэкенд недоступен, можно оставить админа:
      //setUser({ whois: 'admin', username: 'TestAdmin' }); 
      //setAccountCategories(['Test_Acc_1', 'Test_Acc_2']);
    } finally {
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();
    
    const themeParams = WebApp.themeParams;
    const root = document.documentElement;
    root.style.setProperty('--tg-bg-color', themeParams.bg_color || '#ffffff');
    root.style.setProperty('--tg-text-color', themeParams.text_color || '#000000');
    root.style.setProperty('--tg-button-color', themeParams.button_color || '#2481cc');
    root.style.setProperty('--tg-button-text-color', themeParams.button_text_color || '#ffffff');
    
    fetchUserData();
  }, []);

  useEffect(() => {
    if (showSuccessNotification) {
      const timer = setTimeout(() => setShowSuccessNotification(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessNotification]);

  const validateUrl = (url) => {
    if (!url.trim()) return 'Поле не может быть пустым';
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return '';
    } catch (e) {
      return 'Введите корректную ссылку';
    }
  };

  const handleUrlChange = (id, value) => {
    setForms(forms.map(form => form.id === id ? { ...form, url: value, urlError: '' } : form));
  };

  const handleCategoryChange = (id, value) => {
    setForms(forms.map(form => form.id === id ? { ...form, category: value, categoryError: '' } : form));
  };

  const addForm = () => {
    setForms([...forms, { id: Date.now(), url: '', category: '', urlError: '', categoryError: '' }]);
  };

  const removeForm = (id) => {
    if (forms.length > 1) setForms(forms.filter(form => form.id !== id));
  };

  const handleSubmit = async () => {
    let hasErrors = false;
    const updatedForms = forms.map(form => {
      const urlError = validateUrl(form.url);
      const categoryError = !form.category ? 'Выберите аккаунт' : ''; 
      if (urlError || categoryError) hasErrors = true;
      return { ...form, urlError, categoryError };
    });

    setForms(updatedForms);

    if (!hasErrors) {
      try {
        const response = await fetch(`${BACKEND_URL}/analytics_add`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `twa-init-data ${WebApp.initData}`,
            'ngrok-skip-browser-warning': 'true'
          },
          body: JSON.stringify({
            data: forms.map(f => ({ post_url: f.url, account_name: f.category, likes: 0, views: 0 }))
          })
        });

        if (response.ok) {
          setShowSuccessNotification(true);
          setForms([{ id: 1, url: '', category: '', urlError: '', categoryError: '' }]);
        }
      } catch (error) {
        WebApp.showAlert(`Ошибка сети: ${error.message}`);
      }
    }
  };

// Добавить новую пару полей для аккаунта
const addAccountField = () => {
    setNewUser(prev => ({
        ...prev,
        accounts: [...prev.accounts, { account_name: '', social_network: 'Instagram' }]
    }));
};

// Удалить конкретный аккаунт из списка
const removeAccountField = (index) => {
    setNewUser(prev => ({
        ...prev,
        accounts: prev.accounts.filter((_, i) => i !== index)
    }));
};

// Обновить данные конкретного аккаунта
const updateAccountData = (index, field, value) => {
    setNewUser(prev => ({
        ...prev,
        accounts: prev.accounts.map((acc, i) => 
            i === index ? { ...acc, [field]: value } : acc
        )
    }));
};

const fetchLogs = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/sync/logs`, {
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (response.ok) {
            const data = await response.json();
            // Объединяем логи в одну строку с переносом
            setSyncLogs(data.logs.join('\n'));
        }
    } catch (e) {
        console.error("Ошибка получения логов", e);
    }
};

const handleSyncStart = async () => {
    setIsSyncing(true);
    setSyncLogs("Подключение к серверу...");
    
    // Запускаем опрос логов каждые 3 секунды
    const interval = setInterval(fetchLogs, 3000);
    
    try {
        await fetch(`${BACKEND_URL}/sync/start`, {
            method: 'POST',
            headers: { 'Authorization': `twa-init-data ${WebApp.initData}` }
        });
    } catch (e) {
        setSyncLogs(prev => prev + "\n Ошибка запуска");
    } finally {
        // Останавливаем опрос через 2 минуты (или когда решишь)
        setTimeout(() => {
            clearInterval(interval);
            setIsSyncing(false);
        }, 120000); 
    }
};

const handleRegisterUser = async () => {
    let errors = {};
    
    // 1. Валидация основных полей
    if (!newUser.telegram_id || isNaN(newUser.telegram_id)) errors.telegram_id = true;
    if (!newUser.username || !newUser.username.startsWith('@')) errors.username = true;
    if (!newUser.name_soname.trim()) errors.name_soname = true;
    
    // 2. Валидация массива аккаунтов
    const accountErrors = newUser.accounts.map(acc => !acc.account_name.trim());
    if (accountErrors.includes(true)) errors.accounts = accountErrors;

    setAdminErrors(errors);
    if (Object.keys(errors).length > 0) {
        WebApp.HapticFeedback.notificationOccurred('error');
        return;
    }

    // 3. Подготовка данных для отправки
    const cleanUsername = newUser.username.trim();
    const payload = {
        telegram_id: parseInt(newUser.telegram_id),
        username: cleanUsername,
        name_soname: newUser.name_soname.trim(),
        accounts: newUser.accounts.map(acc => ({
            account_name: acc.account_name.trim(),
            social_network: acc.social_network,
            username_at: cleanUsername 
        }))
    };

    try {
        const response = await fetch(`${BACKEND_URL}/register_user`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `twa-init-data ${WebApp.initData}`,
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            WebApp.HapticFeedback.notificationOccurred('success');
            // Сброс формы в начальное состояние
            setNewUser({
                telegram_id: '',
                username: '',
                name_soname: '',
                accounts: [{ account_name: '', social_network: 'Instagram' }]
            });
            setAdminErrors({});
            WebApp.showAlert("Пользователь успешно зарегистрирован!");
        } else {
            const errorData = await response.json();
            WebApp.HapticFeedback.notificationOccurred('error');
            WebApp.showAlert(`Ошибка сервера: ${errorData.detail || 'Не удалось сохранить данные'}`);
        }
    } catch (e) {
        console.error("Registration error:", e);
        WebApp.showAlert("Критическая ошибка сети. Проверьте соединение с сервером.");
    }
};

return (
    <div className="app-container">
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '100px', fontSize: '20px', color: 'var(--tg-hint-color)' }}>
          Загрузка системы...
        </div>
      ) : (
        <>
          {showSuccessNotification && (
            <div style={{ position: 'fixed', top: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: '#34c759', color: '#fff', padding: '20px 40px', borderRadius: '100px', fontWeight: '800', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              УСПЕШНО ОТПРАВЛЕНО
            </div>
          )}

          <header className="header">
            <img src={logo} alt="Logo" className="header-logo" />
            <h1>dm_Analytics</h1>
          </header>

          {isAuthFailed ? (
            <div className="form-block" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: '600' }}>Доступ ограничен</p>
              <p style={{ opacity: 0.6 }}>Пожалуйста, обратитесь к администратору @daniilMalgin</p>
            </div>
          ) : (
            <>
              {user?.whois === 'admin' && (
                <nav className="tab-switcher">
                  <button className={`tab-btn ${activeTab === 'user' ? 'active' : ''}`} onClick={() => setActiveTab('user')}>
                    ССЫЛКИ
                  </button>
                  <button className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')}>
                    АДМИНИСТРИРОВАНИЕ
                  </button>
                </nav>
              )}

              {activeTab === 'user' ? (
                <main style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {forms.map((form, index) => (
                    <div key={form.id} className="form-block">
                      {forms.length > 1 && (
                        <button className="remove-btn" onClick={() => removeForm(form.id)}>×</button>
                      )}
                      <p className="section-subtitle" style={{ fontSize: '11px', fontWeight: '900', color: 'var(--tg-hint-color)', marginBottom: '20px', opacity: 0.5 }}>
                        ФОРМА ВВОДА №{index + 1}
                      </p>
                      
                      <div className="input-group">
                        <label>Ссылка на публикацию</label>
                        <input
                          type="text"
                          className={`input-field ${form.urlError ? 'error' : ''}`}
                          placeholder="https://example.com/p/..."
                          value={form.url}
                          onChange={(e) => handleUrlChange(form.id, e.target.value)}
                        />
                      </div>
                      
                      <div className="input-group">
                        <label>Целевой аккаунт</label>
                        <select
                          className={`select-field ${form.categoryError ? 'error' : ''}`}
                          value={form.category}
                          onChange={(e) => handleCategoryChange(form.id, e.target.value)}
                        >
                          <option value="">— Выберите из списка —</option>
                          {accountCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  <button className="add-form-btn" onClick={addForm}>+ ДОБАВИТЬ ЕЩЁ ОДНУ ССЫЛКУ</button>
                  <button className="submit-btn" onClick={handleSubmit}>ОТПРАВИТЬ ОТЧЕТ</button>
                </main>
              ) : (
                <main style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  <div className="accordion-item">
                    <div className="accordion-header" onClick={() => toggleSection('registration')}>
                      <span>РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ</span>
                      <span>{openSections.registration ? '▲' : '▼'}</span>
                    </div>
                    {openSections.registration && (
                        <div className="accordion-content">
                      <div className="form-block" style={{ borderTop: 'none', borderRadius: '0 0 24px 24px' }}>
                        <div className="input-group">
                          <label>Telegram ID (цифры)</label>
                          <input type="number" className="input-field" placeholder="Пример: 5829103" value={newUser.telegram_id} onChange={(e) => setNewUser({...newUser, telegram_id: e.target.value})} />
                        </div>
                        <div className="input-group">
                          <label>Никнейм</label>
                          <input type="text" className="input-field" placeholder="@username" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} />
                        </div>
                        <div className="input-group">
                          <label>Полное имя</label>
                          <input type="text" className="input-field" placeholder="Имя Фамилия" value={newUser.name_soname} onChange={(e) => setNewUser({...newUser, name_soname: e.target.value})} />
                        </div>
                        
                        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                          <p style={{ fontSize: '12px', fontWeight: '800', opacity: 0.6, marginBottom: '15px' }}>ПРИВЯЗКА АККАУНТОВ</p>
                          {newUser.accounts.map((acc, index) => (
                            <div key={index} className="admin-account-card">
                              {newUser.accounts.length > 1 && (
                                <button className="remove-btn" onClick={() => removeAccountField(index)}>×</button>
                              )}
                              <div className="input-group" style={{ marginBottom: 0 }}>
                                <label>Название</label>
                                <input type="text" className="input-field" placeholder="acc_name" value={acc.account_name} onChange={(e) => updateAccountData(index, 'account_name', e.target.value)} />
                              </div>
                              <div className="input-group" style={{ marginBottom: 0 }}>
                                <label>Платформа</label>
                                <select className="select-field" value={acc.social_network} onChange={(e) => updateAccountData(index, 'social_network', e.target.value)}>
                                  <option value="Instagram">Instagram</option>
                                  <option value="Tiktok">Tiktok</option>
                                  <option value="YouTube">YouTube</option>
                                  <option value="VK">VK</option>
                                </select>
                              </div>
                            </div>
                          ))}
                          <button className="add-form-btn" style={{ marginTop: '20px', padding: '12px' }} onClick={addAccountField}>+ ДОБАВИТЬ АККАУНТ</button>
                        </div>
                        <button className="submit-btn" style={{ marginTop: '30px' }} onClick={handleRegisterUser}>ЗАРЕГИСТРИРОВАТЬ В БАЗЕ</button>
                      </div>
                      </div>
                    )}
                  </div> 

                  {/* АККОРДЕОН КОМАНДЫ */}
                  <div className="accordion-item">
                    <div className="accordion-header" onClick={() => toggleSection('teamList')}>
                      <span>ПОЛЬЗОВАТЕЛИ</span>
                      <span>{openSections.teamList ? '▲' : '▼'}</span>
                    </div>
                    {openSections.teamList && (
                        <div className="accordion-content">
                      <div className="form-block" style={{ borderTop: 'none', borderRadius: '0 0 24px 24px' }}>
                        {isTeamLoading ? (
                          <p>Загрузка списка...</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {teamData.map((member, idx) => (
                              <div key={idx} style={{ padding: '16px', background: 'var(--tg-bg-color)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{member.name_soname}</div>
                                  <div style={{ color: 'var(--tg-link-color)', fontSize: '13px', fontWeight: '600' }}>{member.username}</div>
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: '800', opacity: 0.4, background: 'var(--tg-secondary-bg-color)', padding: '4px 8px', borderRadius: '8px' }}>
                                  {member.whois.toUpperCase()}
                                </span>
                              </div>
                              
                            ))}
                          </div>
                        )}
                      </div>
                      </div>
                    )}
                  </div>
                  {/* СБОР СТАТИСТИКИ */}
<div className="accordion-item">
  <div className="accordion-header" onClick={() => toggleSection('analytics')}>
    <span>СБОР СТАТИСТИКИ</span>
    <span>{openSections.analytics ? '▲' : '▼'}</span>
  </div>
  {openSections.analytics && (
    <div className="accordion-content">
      <div className="form-block" style={{ borderTop: 'none', borderRadius: '0 0 24px 24px' }}>
        
        {/* Окошко логов */}
        <div style={{ 
          background: '#1c1c1d', 
          color: '#00ff00', 
          padding: '12px', 
          borderRadius: '12px', 
          fontFamily: 'monospace', 
          fontSize: '11px', 
          minHeight: '80px',
          maxHeight: '150px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          {syncLogs}
        </div>

        <button 
          className="submit-btn" 
          onClick={handleSyncStart}
          disabled={isSyncing}
          style={{ opacity: isSyncing ? 0.6 : 1 }}
        >
          {isSyncing ? 'ПРОЦЕСС...' : 'ЗАПУСТИТЬ СБОР ДАННЫХ'}
        </button>
      </div>
    </div>
  )}
</div>
                </main>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

}

export default App;