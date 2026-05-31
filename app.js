// ============== TV CHANNEL FINDER С ПОЛНОЙ ИНТЕГРАЦИЕЙ GITHUB API ==============

class TVChannelFinder {
    constructor() {
        // GitHub API настройки
        this.githubToken = this.loadGitHubToken();
        this.githubApiUrl = 'https://api.github.com';
        this.searchCache = new Map();
        
        // Состояние приложения
        this.currentLanguage = 'russian';
        this.searchResults = [];
        this.playlist = this.loadPlaylist();
        this.isSearching = false;
        
        this.init();
    }
    
    loadGitHubToken() {
        // Пробуем загрузить токен из localStorage
        const savedToken = localStorage.getItem('github_token');
        if (savedToken) {
            console.log('✅ GitHub токен загружен из localStorage');
            return savedToken;
        }
        
        // Или используем демо-токен (лучше запросить у пользователя)
        const demoToken = prompt(
            '🔑 Для увеличения лимита запросов (до 5000 в час) введите GitHub токен.\n' +
            'Если токена нет - нажмите Отмена (будет 60 запросов в час)\n\n' +
            'Как получить токен: GitHub Settings → Developer settings → Personal access tokens'
        );
        
        if (demoToken && demoToken.length > 10) {
            localStorage.setItem('github_token', demoToken);
            return demoToken;
        }
        
        return null;
    }
    
    init() {
        // DOM элементы
        this.searchInput = document.getElementById('channelSearch');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.resultsCount = document.getElementById('resultsCount');
        this.playlistContainer = document.getElementById('playlistContainer');
        this.clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
        
        // Добавляем кнопку для сброса токена
        this.addTokenResetButton();
        
        // Языковые кнопки
        this.langBtns = document.querySelectorAll('.lang-btn');
        
        // Превью модалка
        this.previewModal = document.getElementById('previewModal');
        this.previewPlayer = document.getElementById('previewPlayer');
        this.previewTitle = document.getElementById('previewTitle');
        this.closePreview = document.getElementById('closePreview');
        
        // Обработчики
        this.searchBtn.addEventListener('click', () => this.searchChannels());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchChannels();
        });
        
        this.langBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.langBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentLanguage = btn.dataset.lang;
                if (this.searchInput.value.trim()) {
                    this.searchChannels();
                }
            });
        });
        
        this.clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());
        this.closePreview.addEventListener('click', () => this.closePreviewModal());
        
        // Загружаем плейлист
        this.renderPlaylist();
        
        // Показываем информацию о лимитах
        this.checkGitHubRateLimit();
        
        console.log('✅ TV Channel Finder с GitHub API готов к работе');
    }
    
    addTokenResetButton() {
        // Добавляем кнопку сброса токена в интерфейс
        const header = document.querySelector('.header');
        if (header && !document.getElementById('resetTokenBtn')) {
            const resetBtn = document.createElement('button');
            resetBtn.id = 'resetTokenBtn';
            resetBtn.innerHTML = '<i class="fas fa-key"></i> Сменить токен';
            resetBtn.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(255,255,255,0.2);
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                color: white;
                cursor: pointer;
                font-size: 12px;
            `;
            resetBtn.onclick = () => {
                localStorage.removeItem('github_token');
                this.githubToken = null;
                this.showToast('Токен удален. Обновите страницу чтобы ввести новый.', 'info');
                setTimeout(() => location.reload(), 2000);
            };
            header.style.position = 'relative';
            header.appendChild(resetBtn);
        }
    }
    
    async checkGitHubRateLimit() {
        try {
            const headers = this.githubToken ? { 'Authorization': `token ${this.githubToken}` } : {};
            const response = await fetch(`${this.githubApiUrl}/rate_limit`, { headers });
            
            if (response.status === 200) {
                const data = await response.json();
                const core = data.resources.core;
                const remaining = core.remaining;
                const limit = core.limit;
                const resetTime = new Date(core.reset * 1000);
                
                const message = `🔑 GitHub API: ${remaining}/${limit} запросов осталось. Сброс: ${resetTime.toLocaleTimeString()}`;
                console.log(message);
                
                if (remaining < 10) {
                    this.showToast(`⚠️ Осталось всего ${remaining} запросов! Лимит сбросится в ${resetTime.toLocaleTimeString()}`, 'warning');
                } else if (remaining > 0) {
                    this.showToast(message, 'info');
                }
            }
        } catch (error) {
            console.warn('Не удалось проверить лимиты GitHub API:', error);
        }
    }
    
    async searchChannels() {
        if (this.isSearching) {
            this.showToast('Поиск уже выполняется. Подождите...', 'warning');
            return;
        }
        
        const query = this.searchInput.value.trim();
        if (!query) {
            this.showToast('Введите название канала', 'warning');
            return;
        }
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            // Поиск через GitHub API с улучшенными параметрами
            const channels = await this.searchGitHubAdvanced(query);
            
            if (channels.length === 0) {
                this.showNoResults();
                return;
            }
            
            // Проверяем доступность с прогрессом
            this.searchResults = await this.checkAvailabilityWithProgress(channels);
            
            if (this.searchResults.length === 0) {
                this.showToast('Ни одного рабочего потока не найдено. Попробуйте другой канал.', 'warning');
                this.showNoResults();
                return;
            }
            
            // Отображаем результаты
            this.renderResults(this.searchResults);
            this.showToast(`✅ Найдено ${this.searchResults.length} рабочих потоков для "${query}"`, 'success');
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            this.showError('Ошибка при поиске. Возможно, превышен лимит запросов к GitHub API.');
        } finally {
            this.isSearching = false;
        }
    }
    
    async searchGitHubAdvanced(channelName) {
        // Расширенные поисковые запросы
        const searchTerms = this.getSearchTerms(channelName);
        let allChannels = [];
        let cacheKey = `${channelName}_${this.currentLanguage}`;
        
        // Проверяем кэш
        if (this.searchCache.has(cacheKey)) {
            console.log('📦 Используем кэшированные результаты');
            return this.searchCache.get(cacheKey);
        }
        
        for (const searchConfig of searchTerms) {
            try {
                const results = await this.executeGitHubSearch(searchConfig);
                allChannels.push(...results);
                
                // Небольшая задержка между запросами чтобы не превысить лимит
                await this.delay(500);
                
            } catch (error) {
                console.warn(`Ошибка поиска по запросу ${searchConfig.query}:`, error);
            }
        }
        
        // Фильтруем и убираем дубликаты
        const uniqueChannels = this.filterUniqueChannels(allChannels);
        
        // Сохраняем в кэш на 5 минут
        this.searchCache.set(cacheKey, uniqueChannels);
        setTimeout(() => this.searchCache.delete(cacheKey), 5 * 60 * 1000);
        
        return uniqueChannels;
    }
    
    getSearchTerms(channelName) {
        const langSpecificTerms = {
            russian: ['россия', 'ru', 'russian', 'русский'],
            english: ['usa', 'uk', 'us', 'english'],
            arabic: ['arab', 'عربية', 'مباشر'],
            german: ['deutsch', 'germany', 'de'],
            french: ['france', 'francais', 'fr']
        };
        
        const langTerms = langSpecificTerms[this.currentLanguage] || langSpecificTerms.russian;
        
        const baseQueries = [
            { query: `${channelName} tv m3u`, priority: 1 },
            { query: `${channelName} channel m3u8`, priority: 2 },
            { query: `${channelName} iptv playlist`, priority: 2 },
            { query: `${channelName} live stream`, priority: 3 }
        ];
        
        const queries = [];
        
        // Добавляем базовые запросы
        for (const q of baseQueries) {
            queries.push({ ...q, query: q.query });
            
            // Добавляем языковые варианты
            for (const lang of langTerms) {
                queries.push({ 
                    query: `${q.query} ${lang}`,
                    priority: q.priority + 0.5
                });
            }
        }
        
        // Сортируем по приоритету
        return queries.sort((a, b) => a.priority - b.priority);
    }
    
    async executeGitHubSearch(searchConfig) {
        const extensions = ['m3u', 'm3u8'];
        let allItems = [];
        
        for (const ext of extensions) {
            const searchQuery = `${searchConfig.query} extension:${ext}`;
            const url = `${this.githubApiUrl}/search/code?q=${encodeURIComponent(searchQuery)}&per_page=30`;
            
            const headers = this.githubToken ? { 'Authorization': `token ${this.githubToken}` } : {};
            const response = await fetch(url, { headers });
            
            if (response.status === 403) {
                // Превышен лимит
                const resetTime = response.headers.get('X-RateLimit-Reset');
                if (resetTime) {
                    const waitTime = new Date(resetTime * 1000) - Date.now();
                    throw new Error(`Превышен лимит запросов. Подождите ${Math.ceil(waitTime / 60000)} минут`);
                }
                throw new Error('Превышен лимит запросов к GitHub API');
            }
            
            if (response.status === 200) {
                const data = await response.json();
                const items = data.items || [];
                
                // Парсим каждый найденный файл
                for (const item of items) {
                    const channels = await this.parseGitHubFileContent(item);
                    allItems.push(...channels);
                }
            }
        }
        
        return allItems;
    }
    
    async parseGitHubFileContent(fileInfo) {
        const channels = [];
        
        try {
            // Получаем содержимое файла через raw.githubusercontent.com
            const rawUrl = fileInfo.url
                .replace('api.github.com/repos', 'raw.githubusercontent.com')
                .replace('/contents/', '/');
            
            const response = await fetch(rawUrl);
            if (!response.ok) return channels;
            
            const content = await response.text();
            const lines = content.split('\n');
            
            let currentChannel = null;
            let lineNumber = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                lineNumber++;
                
                if (line.startsWith('#EXTINF:')) {
                    // Извлекаем название канала
                    let name = 'Unknown';
                    const nameMatch = line.match(/,([^,]+)$/);
                    if (nameMatch) {
                        name = nameMatch[1].trim();
                        // Убираем лишние символы
                        name = name.replace(/[^\w\s\u0400-\u04FF\-\(\)]/g, '');
                    }
                    
                    // Извлекаем tvg-name если есть
                    const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
                    if (tvgNameMatch && tvgNameMatch[1]) {
                        name = tvgNameMatch[1];
                    }
                    
                    // Извлекаем группу
                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    const group = groupMatch ? groupMatch[1] : '';
                    
                    // Извлекаем логотип
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    const logo = logoMatch ? logoMatch[1] : '';
                    
                    currentChannel = { 
                        name: this.normalizeName(name),
                        group: group,
                        logo: logo,
                        lineNumber: lineNumber
                    };
                    
                } else if (line && !line.startsWith('#') && currentChannel) {
                    // URL канала - проверяем что это не ссылка на GitHub
                    if (!line.includes('github.com') && 
                        !line.includes('raw.githubusercontent.com') &&
                        line.startsWith('http')) {
                        
                        currentChannel.url = line;
                        channels.push({ ...currentChannel });
                    }
                    currentChannel = null;
                }
            }
            
            console.log(`📄 Парсинг ${fileInfo.path}: найдено ${channels.length} каналов`);
            
        } catch (error) {
            console.warn(`Ошибка парсинга файла ${fileInfo.path}:`, error.message);
        }
        
        return channels;
    }
    
    normalizeName(name) {
        // Убираем лишние пробелы и специальные символы
        let normalized = name
            .replace(/\s+/g, ' ')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
            .trim();
        
        // Проверяем, соответствует ли название поисковому запросу
        const searchQuery = this.searchInput.value.trim().toLowerCase();
        if (!normalized.toLowerCase().includes(searchQuery)) {
            // Если название не совпадает, но может быть похожим каналом
            // Например: ищем "СТС", находим "CTC"
            const similar = this.isSimilar(normalized, searchQuery);
            if (!similar) {
                return normalized + " (похожий)";
            }
        }
        
        return normalized;
    }
    
    isSimilar(str1, str2) {
        // Простая проверка на схожесть
        const s1 = str1.toLowerCase().replace(/[^a-zа-я]/g, '');
        const s2 = str2.toLowerCase().replace(/[^a-zа-я]/g, '');
        return s1.includes(s2) || s2.includes(s1);
    }
    
    filterUniqueChannels(channels) {
        const uniqueMap = new Map();
        
        for (const channel of channels) {
            // Используем URL как уникальный ключ
            if (!uniqueMap.has(channel.url)) {
                uniqueMap.set(channel.url, channel);
            }
        }
        
        return Array.from(uniqueMap.values());
    }
    
    async checkAvailabilityWithProgress(channels) {
        const checked = [];
        const total = Math.min(channels.length, 30); // Проверяем максимум 30 каналов
        
        for (let i = 0; i < total; i++) {
            const channel = channels[i];
            this.updateProgress(i + 1, total, channel.name);
            
            const isWorking = await this.testStream(channel.url);
            
            if (isWorking) {
                checked.push({
                    ...channel,
                    working: true,
                    source: i + 1,
                    checkedAt: new Date().toISOString()
                });
                console.log(`✅ Рабочий поток ${i + 1}/${total}: ${channel.name}`);
            } else {
                console.log(`❌ Нерабочий поток ${i + 1}/${total}: ${channel.name}`);
            }
            
            // Небольшая задержка между проверками
            await this.delay(200);
        }
        
        // Сортируем по качеству (можно добавить анализ URL)
        return checked.sort((a, b) => {
            // Приоритет: .m3u8 перед .ts, http перед https
            const aQuality = a.url.includes('.m3u8') ? 1 : a.url.includes('.ts') ? 2 : 3;
            const bQuality = b.url.includes('.m3u8') ? 1 : b.url.includes('.ts') ? 2 : 3;
            return aQuality - bQuality;
        });
    }
    
    testStream(url) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.muted = true;
            let resolved = false;
            let hlsInstance = null;
            
            const cleanup = () => {
                if (hlsInstance) {
                    try { hlsInstance.destroy(); } catch(e) {}
                }
                video.pause();
                video.src = '';
                video.load();
            };
            
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(false);
                }
            }, 8000); // 8 секунд на проверку
            
            if (Hls.isSupported()) {
                hlsInstance = new Hls({
                    manifestLoadingTimeOut: 5000,
                    levelLoadingTimeOut: 5000,
                    fragLoadingTimeOut: 5000,
                    manifestLoadingMaxRetry: 1,
                    levelLoadingMaxRetry: 1,
                    fragLoadingMaxRetry: 1
                });
                
                hlsInstance.loadSource(url);
                hlsInstance.attachMedia(video);
                
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                    clearTimeout(timeout);
                    resolved = true;
                    cleanup();
                    resolve(true);
                });
                
                hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        clearTimeout(timeout);
                        resolved = true;
                        cleanup();
                        resolve(false);
                    }
                });
                
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
                video.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeout);
                    resolved = true;
                    cleanup();
                    resolve(true);
                }, { once: true });
                
                video.addEventListener('error', () => {
                    clearTimeout(timeout);
                    resolved = true;
                    cleanup();
                    resolve(false);
                }, { once: true });
                
                // Пытаемся запустить воспроизведение
                video.play().catch(() => {});
                
            } else {
                clearTimeout(timeout);
                resolve(false);
            }
        });
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    renderResults(channels) {
        this.resultsCount.textContent = `${channels.length} рабочих источников`;
        
        const html = channels.map((channel, index) => `
            <div class="result-card" data-url="${channel.url}" data-name="${this.escapeHtml(channel.name)}" data-group="${this.escapeHtml(channel.group || '')}">
                <div class="result-header">
                    <div class="result-name">
                        <i class="fas fa-tv"></i> 
                        ${this.escapeHtml(channel.name)}
                        ${channel.group ? `<span style="font-size: 11px; color: #888;"> (${this.escapeHtml(channel.group)})</span>` : ''}
                    </div>
                    <div class="result-status">
                        <i class="fas fa-check-circle"></i> Работает
                    </div>
                </div>
                <div class="result-url">
                    <i class="fas fa-link"></i> ${this.shortenUrl(channel.url)}
                </div>
                <div class="result-actions">
                    <button class="preview-btn" onclick="app.previewChannel(${index})">
                        <i class="fas fa-play"></i> Предпросмотр
                    </button>
                    <button class="add-btn" onclick="app.addToPlaylist(${index})">
                        <i class="fas fa-plus"></i> Добавить в плейлист
                    </button>
                </div>
            </div>
        `).join('');
        
        this.resultsContainer.innerHTML = html;
    }
    
    previewChannel(index) {
        const channel = this.searchResults[index];
        if (!channel) return;
        
        this.previewTitle.textContent = channel.name;
        this.previewModal.style.display = 'flex';
        
        // Очищаем предыдущий поток
        if (this.previewPlayer.hls) {
            this.previewPlayer.hls.destroy();
        }
        this.previewPlayer.src = '';
        
        // Загружаем новый поток с улучшенными настройками
        if (Hls.isSupported()) {
            const hls = new Hls({
                liveDurationInfinity: true,
                enableWorker: true,
                manifestLoadingTimeOut: 15000,
                levelLoadingTimeOut: 15000,
                fragLoadingTimeOut: 15000
            });
            
            hls.loadSource(channel.url);
            hls.attachMedia(this.previewPlayer);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.previewPlayer.play().catch(e => console.log('Autoplay blocked:', e));
            });
            this.previewPlayer.hls = hls;
        } else {
            this.previewPlayer.src = channel.url;
            this.previewPlayer.play().catch(e => console.log('Autoplay blocked:', e));
        }
    }
    
    addToPlaylist(index) {
        const channel = this.searchResults[index];
        if (!channel) return;
        
        // Проверяем, есть ли уже в плейлисте
        const exists = this.playlist.some(item => item.url === channel.url);
        if (exists) {
            this.showToast('Этот канал уже в плейлисте', 'info');
            return;
        }
        
        this.playlist.push({
            id: Date.now(),
            name: channel.name,
            url: channel.url,
            group: channel.group,
            addedAt: new Date().toISOString()
        });
        
        this.savePlaylist();
        this.renderPlaylist();
        this.showToast(`✅ "${channel.name}" добавлен в плейлист`, 'success');
        
        // Меняем кнопку
        const btn = document.querySelector(`.result-card[data-url="${channel.url}"] .add-btn`);
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Добавлено';
            btn.disabled = true;
            btn.classList.add('added');
        }
    }
    
    renderPlaylist() {
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="empty-playlist">
                    <i class="fas fa-plus-circle"></i>
                    <p>Добавьте каналы из результатов поиска</p>
                    <small style="color: #888; margin-top: 10px; display: block;">
                        Найденные каналы автоматически проверяются на доступность
                    </small>
                </div>
            `;
            return;
        }
        
        const html = this.playlist.map((item, index) => `
            <div class="playlist-item" data-id="${item.id}">
                <div class="playlist-item-info">
                    <div class="playlist-item-name">
                        <i class="fas fa-tv"></i> ${this.escapeHtml(item.name)}
                    </div>
                    <div class="playlist-item-url">
                        ${item.group ? `<i class="fas fa-folder"></i> ${this.escapeHtml(item.group)}<br>` : ''}
                        <i class="fas fa-link"></i> ${this.shortenUrl(item.url)}
                    </div>
                </div>
                <div class="playlist-item-actions">
                    <button class="play-btn" onclick="app.previewFromPlaylist('${item.id}')" title="Смотреть">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="remove-btn" onclick="app.removeFromPlaylist(${index})" title="Удалить">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        this.playlistContainer.innerHTML = html;
    }
    
    previewFromPlaylist(id) {
        const channel = this.playlist.find(item => item.id == id);
        if (!channel) return;
        
        this.previewTitle.textContent = channel.name;
        this.previewModal.style.display = 'flex';
        
        if (this.previewPlayer.hls) {
            this.previewPlayer.hls.destroy();
        }
        this.previewPlayer.src = '';
        
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(channel.url);
            hls.attachMedia(this.previewPlayer);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.previewPlayer.play().catch(e => console.log('Autoplay blocked'));
            });
            this.previewPlayer.hls = hls;
        } else {
            this.previewPlayer.src = channel.url;
            this.previewPlayer.play().catch(e => console.log('Autoplay blocked'));
        }
    }
    
    removeFromPlaylist(index) {
        const channel = this.playlist[index];
        this.playlist.splice(index, 1);
        this.savePlaylist();
        this.renderPlaylist();
        this.showToast(`❌ "${channel.name}" удален из плейлиста`, 'info');
    }
    
    clearPlaylist() {
        if (confirm('Очистить весь плейлист? Все каналы будут удалены.')) {
            this.playlist = [];
            this.savePlaylist();
            this.renderPlaylist();
            this.showToast('Плейлист очищен', 'info');
        }
    }
    
    loadPlaylist() {
        const saved = localStorage.getItem('tv_playlist');
        return saved ? JSON.parse(saved) : [];
    }
    
    savePlaylist() {
        localStorage.setItem('tv_playlist', JSON.stringify(this.playlist));
    }
    
    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                <p>🔍 Поиск каналов через GitHub API...</p>
                <small style="color: #888; margin-top: 10px; display: block;">
                    Поиск может занять 10-30 секунд
                </small>
            </div>
        `;
        this.resultsCount.textContent = 'Поиск...';
    }
    
    updateProgress(current, total, channelName) {
        this.resultsCount.textContent = `Проверка: ${current}/${total}`;
        
        // Обновляем сообщение в контейнере результатов
        const loadingDiv = this.resultsContainer.querySelector('.loading');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <i class="fas fa-spinner"></i>
                <p>🔍 Проверка доступности потоков...</p>
                <p style="font-size: 14px; margin-top: 10px;">Проверено: ${current}/${total}</p>
                <p style="font-size: 12px; color: #888;">${channelName || ''}</p>
                <div style="width: 80%; height: 4px; background: #e0e0e0; margin-top: 20px; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${(current/total)*100}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s;"></div>
                </div>
            `;
        }
    }
    
    showNoResults() {
        this.resultsContainer.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-search"></i>
                <h3>Каналы не найдены</h3>
                <p>Попробуйте:</p>
                <ul style="text-align: left; margin-top: 15px;">
                    <li>• Проверить правильность написания</li>
                    <li>• Использовать другое название (например, "ТНТ" вместо "ТНТ канал")</li>
                    <li>• Попробовать английское название (например, "Russia 1")</li>
                    <li>• Сменить язык поиска</li>
                    <li>• Добавить GitHub токен для увеличения лимита запросов</li>
                </ul>
            </div>
        `;
        this.resultsCount.textContent = '0 источников';
    }
    
    showError(message) {
        this.resultsContainer.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка</h3>
                <p>${message}</p>
                <button onclick="app.checkGitHubRateLimit()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Проверить лимиты API
                </button>
            </div>
        `;
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#2196f3'};
            color: white;
            padding: 12px 24px;
            border-radius: 50px;
            z-index: 10000;
            animation: slideUp 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }
    
    shortenUrl(url) {
        if (url.length > 60) {
            return url.substring(0, 60) + '...';
        }
        return url;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Запуск приложения после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TVChannelFinder();
});
