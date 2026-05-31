// ============== TV CHANNEL FINDER - С ИНТЕГРАЦИЕЙ GITHUB API ==============

class TVChannelFinder {
    constructor() {
        // GitHub API настройки
        this.githubToken = this.loadGitHubToken();
        this.githubApiUrl = 'https://api.github.com';
        
        // Готовые плейлисты (быстрый поиск)
        this.playlists = {
            russian: [
                { name: 'IPTV-ORG Россия', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ru.m3u' },
                { name: 'Free-IPTV Россия', url: 'https://raw.githubusercontent.com/Free-IPTV/IPTV/master/playlists/ru.m3u' }
            ]
        };
        
        this.cache = new Map();
        this.currentLanguage = 'russian';
        this.searchResults = [];
        this.playlist = this.loadPlaylist();
        this.isSearching = false;
        
        this.init();
    }
    
    loadGitHubToken() {
        // 🚨 ВНИМАНИЕ: Никогда не храните токен в коде!
        // Используйте prompt или localStorage
        
        let token = localStorage.getItem('github_token');
        
        if (!token) {
            token = prompt(
                '🔑 Введите GitHub Personal Access Token\n\n' +
                'Как получить:\n' +
                '1. GitHub Settings → Developer settings\n' +
                '2. Personal access tokens → Tokens (classic)\n' +
                '3. Generate new token\n' +
                '4. Выберите права: repo, read:user\n\n' +
                'Без токена - 60 запросов/час\n' +
                'С токеном - 5000 запросов/час'
            );
            
            if (token && token.length > 10) {
                localStorage.setItem('github_token', token);
            }
        }
        
        // ⚠️ Для демонстрации - НЕ ИСПОЛЬЗУЙТЕ В РЕАЛЬНЫХ ПРОЕКТАХ!
        // Это ваш токен, но ОН УЖЕ СКОМПРОМЕТИРОВАН!
        if (!token) {
            // ВРЕМЕННО для демо - удалите после теста!
            token = "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";
            console.warn("⚠️ Используется демо-токен. НЕОБХОДИМО ЗАМЕНИТЬ!");
        }
        
        return token;
    }
    
    async init() {
        // DOM элементы (как в предыдущей версии)
        this.searchInput = document.getElementById('channelSearch');
        this.searchBtn = document.getElementById('searchBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.resultsCount = document.getElementById('resultsCount');
        this.playlistContainer = document.getElementById('playlistContainer');
        this.clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
        
        this.langBtns = document.querySelectorAll('.lang-btn');
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
        
        // Добавляем кнопку управления GitHub токеном
        this.addGitHubControls();
        
        this.renderPlaylist();
        
        // Проверяем лимиты GitHub API
        await this.checkGitHubRateLimit();
        
        console.log('✅ TV Channel Finder с GitHub API готов');
        this.showToast('Введите название канала (СТС, ТНТ, CNN...)', 'info');
        
        await this.preloadPlaylists();
    }
    
    addGitHubControls() {
        // Добавляем кнопку статуса GitHub API
        const header = document.querySelector('.header');
        if (header && !document.getElementById('githubStatus')) {
            const statusDiv = document.createElement('div');
            statusDiv.id = 'githubStatus';
            statusDiv.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                font-size: 11px;
                background: rgba(0,0,0,0.5);
                padding: 4px 8px;
                border-radius: 12px;
                cursor: pointer;
            `;
            statusDiv.innerHTML = '<i class="fab fa-github"></i> Проверка...';
            statusDiv.onclick = () => this.checkGitHubRateLimit();
            header.style.position = 'relative';
            header.appendChild(statusDiv);
        }
    }
    
    async checkGitHubRateLimit() {
        const statusDiv = document.getElementById('githubStatus');
        if (!statusDiv) return;
        
        try {
            const response = await fetch(`${this.githubApiUrl}/rate_limit`, {
                headers: { 'Authorization': `token ${this.githubToken}` }
            });
            
            if (response.status === 200) {
                const data = await response.json();
                const core = data.resources.core;
                const remaining = core.remaining;
                const limit = core.limit;
                const resetTime = new Date(core.reset * 1000);
                
                const percent = (remaining / limit) * 100;
                let color = '#4caf50';
                if (percent < 20) color = '#ff9800';
                if (percent < 5) color = '#f44336';
                
                statusDiv.innerHTML = `<i class="fab fa-github"></i> ${remaining}/${limit}`;
                statusDiv.style.background = `rgba(0,0,0,0.8)`;
                statusDiv.title = `Сброс: ${resetTime.toLocaleTimeString()}`;
                
                if (remaining < 10) {
                    this.showToast(`⚠️ Осталось ${remaining} запросов к GitHub API!`, 'warning');
                }
            } else {
                statusDiv.innerHTML = '<i class="fab fa-github"></i> Без токена';
                statusDiv.title = '60 запросов/час';
            }
        } catch (error) {
            statusDiv.innerHTML = '<i class="fab fa-github"></i> Ошибка';
        }
    }
    
    async searchChannels() {
        if (this.isSearching) {
            this.showToast('Поиск уже выполняется...', 'warning');
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
            // 1. Быстрый поиск в готовых плейлистах
            let channels = await this.searchInPlaylists(query);
            
            // 2. Если не нашли - поиск через GitHub API
            if (channels.length === 0) {
                this.updateStatus('Поиск на GitHub через API...');
                channels = await this.searchOnGitHubAPI(query);
            }
            
            if (channels.length === 0) {
                this.showNoResults(query);
                return;
            }
            
            // 3. Убираем дубликаты
            channels = this.removeDuplicates(channels);
            
            // 4. Проверяем доступность
            this.searchResults = await this.checkAvailability(channels);
            
            if (this.searchResults.length === 0) {
                this.showToast('Потоки найдены, но все недоступны.', 'warning');
                this.showNoResults(query);
                return;
            }
            
            this.renderResults(this.searchResults);
            this.showToast(`✅ Найдено ${this.searchResults.length} рабочих потоков`, 'success');
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            this.showError('Ошибка: ' + error.message);
        } finally {
            this.isSearching = false;
        }
    }
    
    async searchOnGitHubAPI(query) {
        const channels = [];
        const queryLower = query.toLowerCase();
        
        // Формируем поисковые запросы для GitHub API
        const searchQueries = [
            `"${query}" extension:m3u`,
            `${query} tv extension:m3u`,
            `${query} channel extension:m3u8`,
            `${query} iptv extension:m3u`
        ];
        
        this.updateStatus(`Поиск на GitHub (${searchQueries.length} запросов)...`);
        
        for (const searchQuery of searchQueries) {
            try {
                const url = `${this.githubApiUrl}/search/code?q=${encodeURIComponent(searchQuery)}&per_page=20`;
                const response = await fetch(url, {
                    headers: { 'Authorization': `token ${this.githubToken}` }
                });
                
                if (response.status === 200) {
                    const data = await response.json();
                    const items = data.items || [];
                    
                    console.log(`🔍 GitHub: найдено ${items.length} файлов по запросу "${searchQuery}"`);
                    
                    // Парсим каждый найденный файл
                    for (const item of items) {
                        const fileChannels = await this.parseGitHubFile(item, query);
                        channels.push(...fileChannels);
                        
                        // Небольшая задержка между парсингом файлов
                        await this.delay(200);
                    }
                } else if (response.status === 403) {
                    // Превышен лимит
                    const resetTime = response.headers.get('X-RateLimit-Reset');
                    if (resetTime) {
                        const waitTime = new Date(resetTime * 1000) - Date.now();
                        throw new Error(`Лимит GitHub API. Подождите ${Math.ceil(waitTime / 60000)} мин`);
                    }
                }
                
                // Задержка между запросами к API
                await this.delay(500);
                
            } catch (error) {
                console.warn(`Ошибка GitHub поиска:`, error);
            }
        }
        
        return channels;
    }
    
    async parseGitHubFile(fileInfo, searchQuery) {
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
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line.startsWith('#EXTINF:')) {
                    // Извлекаем название
                    let name = this.extractChannelName(line);
                    
                    // Проверяем, соответствует ли название поиску
                    if (name.toLowerCase().includes(searchQuery.toLowerCase())) {
                        currentChannel = { name, group: this.extractGroup(line), logo: this.extractLogo(line) };
                    }
                    
                } else if (line && !line.startsWith('#') && currentChannel && line.startsWith('http')) {
                    // URL найден
                    if (!line.includes('github.com') && !line.includes('raw.githubusercontent.com')) {
                        currentChannel.url = line;
                        currentChannel.source = `GitHub: ${fileInfo.repository.full_name}`;
                        channels.push({ ...currentChannel });
                    }
                    currentChannel = null;
                }
            }
            
            if (channels.length > 0) {
                console.log(`📄 GitHub файл ${fileInfo.path}: найдено ${channels.length} каналов`);
            }
            
        } catch (error) {
            console.warn(`Ошибка парсинга GitHub файла:`, error);
        }
        
        return channels;
    }
    
    async searchInPlaylists(query) {
        const allMatches = [];
        const queryLower = query.toLowerCase();
        const playlistsToSearch = this.playlists[this.currentLanguage] || this.playlists.russian;
        
        this.updateStatus(`Поиск в ${playlistsToSearch.length} плейлистах...`);
        
        for (let i = 0; i < playlistsToSearch.length; i++) {
            const playlist = playlistsToSearch[i];
            this.updateProgress(i + 1, playlistsToSearch.length, playlist.name);
            
            try {
                let channels = this.cache.get(playlist.url);
                
                if (!channels) {
                    const response = await fetch(playlist.url);
                    if (response.ok) {
                        const content = await response.text();
                        channels = this.parseM3U(content, playlist.name);
                        this.cache.set(playlist.url, channels);
                    } else {
                        continue;
                    }
                }
                
                const matches = channels.filter(ch => 
                    ch.name.toLowerCase().includes(queryLower)
                );
                
                if (matches.length > 0) {
                    console.log(`✅ Найдено ${matches.length} каналов в ${playlist.name}`);
                    allMatches.push(...matches.map(ch => ({
                        ...ch,
                        source: playlist.name
                    })));
                }
                
            } catch (error) {
                console.warn(`Ошибка загрузки ${playlist.name}:`, error);
            }
            
            await this.delay(200);
        }
        
        return allMatches;
    }
    
    parseM3U(content, playlistName) {
        const channels = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                const name = this.extractChannelName(line);
                if (!name || name === 'Unknown') continue;
                
                const group = this.extractGroup(line);
                const logo = this.extractLogo(line);
                
                // Ищем URL
                let url = null;
                let j = i + 1;
                while (j < lines.length && !lines[j].trim().startsWith('#EXTINF:') && j < i + 5) {
                    const potentialUrl = lines[j].trim();
                    if (potentialUrl && !potentialUrl.startsWith('#') && potentialUrl.startsWith('http')) {
                        if (!potentialUrl.includes('github.com')) {
                            url = potentialUrl;
                            break;
                        }
                    }
                    j++;
                }
                
                if (name && url) {
                    channels.push({
                        name: this.cleanName(name),
                        url: url,
                        group: group || playlistName || 'Общие',
                        logo: logo
                    });
                }
            }
        }
        
        return channels;
    }
    
    extractChannelName(line) {
        // tvg-name
        const tvgMatch = line.match(/tvg-name="([^"]*)"/);
        if (tvgMatch && tvgMatch[1]) return tvgMatch[1];
        
        // После запятой
        const commaMatch = line.match(/,([^,]+)$/);
        if (commaMatch) {
            return commaMatch[1].trim()
                .replace(/\[.*?\]/g, '')
                .replace(/\(.*?\)/g, '')
                .trim();
        }
        
        return 'Unknown';
    }
    
    extractGroup(line) {
        const groupMatch = line.match(/group-title="([^"]*)"/);
        return groupMatch ? groupMatch[1] : null;
    }
    
    extractLogo(line) {
        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
        return logoMatch ? logoMatch[1] : '';
    }
    
    cleanName(name) {
        return name
            .replace(/HD|SD|FHD|4K|\([^)]*\)|\[[^\]]*\]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    removeDuplicates(channels) {
        const unique = new Map();
        for (const ch of channels) {
            const key = `${ch.name}_${ch.url}`;
            if (!unique.has(key)) {
                unique.set(key, ch);
            }
        }
        return Array.from(unique.values());
    }
    
    async checkAvailability(channels) {
        const working = [];
        const total = Math.min(channels.length, 20);
        
        for (let i = 0; i < total; i++) {
            const channel = channels[i];
            this.updateProgress(i + 1, total, channel.name);
            
            const isWorking = await this.testStream(channel.url);
            
            if (isWorking) {
                working.push({ ...channel, working: true });
                console.log(`✅ [${i+1}/${total}] ${channel.name} - РАБОТАЕТ`);
            } else {
                console.log(`❌ [${i+1}/${total}] ${channel.name} - НЕ РАБОТАЕТ`);
            }
            
            await this.delay(150);
        }
        
        return working;
    }
    
    testStream(url) {
        return new Promise((resolve) => {
            let resolved = false;
            let hlsInstance = null;
            
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (hlsInstance) hlsInstance.destroy();
                    resolve(false);
                }
            }, 5000);
            
            if (Hls && Hls.isSupported()) {
                const video = document.createElement('video');
                video.muted = true;
                
                hlsInstance = new Hls({
                    manifestLoadingTimeOut: 4000,
                    levelLoadingTimeOut: 4000,
                    fragLoadingTimeOut: 4000,
                    manifestLoadingMaxRetry: 1
                });
                
                hlsInstance.loadSource(url);
                hlsInstance.attachMedia(video);
                
                hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
                    clearTimeout(timeout);
                    resolved = true;
                    hlsInstance.destroy();
                    resolve(true);
                });
                
                hlsInstance.on(Hls.Events.ERROR, () => {
                    clearTimeout(timeout);
                    resolved = true;
                    hlsInstance.destroy();
                    resolve(false);
                });
            } else {
                resolve(false);
            }
        });
    }
    
    async preloadPlaylists() {
        console.log('📦 Предзагрузка плейлистов...');
        const ruPlaylists = this.playlists.russian;
        
        for (const playlist of ruPlaylists.slice(0, 2)) {
            if (!this.cache.has(playlist.url)) {
                try {
                    const response = await fetch(playlist.url);
                    if (response.ok) {
                        const content = await response.text();
                        const channels = this.parseM3U(content, playlist.name);
                        this.cache.set(playlist.url, channels);
                        console.log(`✅ Предзагружен: ${playlist.name} (${channels.length} каналов)`);
                    }
                } catch (error) {
                    console.warn(`Не удалось предзагрузить: ${playlist.name}`);
                }
            }
        }
    }
    
    renderResults(channels) {
        this.resultsCount.textContent = `${channels.length} рабочих источников`;
        
        const html = channels.map((channel, index) => `
            <div class="result-card" data-url="${channel.url}">
                <div class="result-header">
                    <div class="result-name">
                        <i class="fas fa-tv"></i> 
                        ${this.escapeHtml(channel.name)}
                        ${channel.source ? `<span style="font-size: 11px; color: #888;"> (${this.escapeHtml(channel.source)})</span>` : ''}
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
                        <i class="fas fa-plus"></i> Добавить
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
        
        if (this.previewPlayer.hls) {
            this.previewPlayer.hls.destroy();
        }
        this.previewPlayer.src = '';
        
        if (Hls && Hls.isSupported()) {
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
    
    closePreviewModal() {
        this.previewModal.style.display = 'none';
        if (this.previewPlayer.hls) {
            this.previewPlayer.hls.destroy();
        }
        this.previewPlayer.pause();
        this.previewPlayer.src = '';
    }
    
    addToPlaylist(index) {
        const channel = this.searchResults[index];
        if (!channel) return;
        
        if (this.playlist.some(item => item.url === channel.url)) {
            this.showToast('Канал уже в плейлисте', 'info');
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
        this.showToast(`✅ "${channel.name}" добавлен`, 'success');
    }
    
    renderPlaylist() {
        if (this.playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="empty-playlist">
                    <i class="fas fa-plus-circle"></i>
                    <p>Добавьте каналы из результатов поиска</p>
                </div>
            `;
            return;
        }
        
        const html = this.playlist.map((item, index) => `
            <div class="playlist-item">
                <div class="playlist-item-info">
                    <div class="playlist-item-name">
                        <i class="fas fa-tv"></i> ${this.escapeHtml(item.name)}
                    </div>
                    <div class="playlist-item-url">
                        ${this.shortenUrl(item.url)}
                    </div>
                </div>
                <div class="playlist-item-actions">
                    <button class="play-btn" onclick="app.previewFromPlaylist(${index})" title="Смотреть">
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
    
    previewFromPlaylist(index) {
        const channel = this.playlist[index];
        if (!channel) return;
        this.previewTitle.textContent = channel.name;
        this.previewModal.style.display = 'flex';
        
        if (this.previewPlayer.hls) this.previewPlayer.hls.destroy();
        this.previewPlayer.src = '';
        
        if (Hls && Hls.isSupported()) {
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
        this.showToast(`❌ "${channel.name}" удален`, 'info');
    }
    
    clearPlaylist() {
        if (confirm('Очистить весь плейлист?')) {
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
                <i class="fas fa-spinner fa-spin"></i>
                <p>🔍 Поиск каналов...</p>
            </div>
        `;
        this.resultsCount.textContent = 'Поиск...';
    }
    
    updateStatus(message) {
        const loadingDiv = this.resultsContainer.querySelector('.loading');
        if (loadingDiv) {
            const p = loadingDiv.querySelector('p');
            if (p) p.textContent = message;
        }
    }
    
    updateProgress(current, total, itemName) {
        this.resultsCount.textContent = `Проверка: ${current}/${total}`;
        
        const loadingDiv = this.resultsContainer.querySelector('.loading');
        if (loadingDiv && current <= total) {
            loadingDiv.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <p>Проверка доступности...</p>
                <p style="font-size: 14px; margin-top: 10px;">${current}/${total}</p>
                <p style="font-size: 12px; color: #888;">${itemName || ''}</p>
                <div style="width: 80%; height: 4px; background: #e0e0e0; margin-top: 20px; border-radius: 2px;">
                    <div style="width: ${(current/total)*100}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2);"></div>
                </div>
            `;
        }
    }
    
    showNoResults(query) {
        this.resultsContainer.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-search"></i>
                <h3>Каналы не найдены</h3>
                <p>По запросу "${this.escapeHtml(query)}" ничего не найдено</p>
                <ul style="margin-top: 20px;">
                    <li>Проверьте правильность написания</li>
                    <li>Используйте короткое название (например "ТНТ")</li>
                    <li>Попробуйте английское название</li>
                </ul>
            </div>
        `;
        this.resultsCount.textContent = '0';
    }
    
    showError(message) {
        this.resultsContainer.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка</h3>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
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
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
    
    shortenUrl(url) {
        return url.length > 60 ? url.substring(0, 60) + '...' : url;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TVChannelFinder();
});
