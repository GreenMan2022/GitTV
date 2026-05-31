// ============== TV CHANNEL FINDER - С УПРАВЛЕНИЕМ ТОКЕНОМ ==============

class TVChannelFinder {
    constructor() {
        // GitHub API настройки
        this.githubToken = this.loadGitHubToken();
        this.githubApiUrl = 'https://api.github.com';
        
        // Кэш для результатов
        this.cache = new Map();
        this.searchCache = new Map();
        this.currentLanguage = 'russian';
        this.searchResults = [];
        this.playlist = this.loadPlaylist();
        this.isSearching = false;
        
        // Языковые модификаторы
        this.langModifiers = {
            russian: ['ru', 'russian', 'россия', 'русский'],
            english: ['en', 'english', 'usa', 'uk'],
            german: ['de', 'german', 'deutsch'],
            french: ['fr', 'french', 'francais'],
            arabic: ['ar', 'arabic', 'عربية']
        };
        
        this.init();
    }
    
    loadGitHubToken() {
        // Загружаем токен из localStorage
        const savedToken = localStorage.getItem('github_token');
        if (savedToken && savedToken.length > 10) {
            console.log('✅ GitHub токен загружен из localStorage');
            return savedToken;
        }
        return null;
    }
    
    saveGitHubToken(token) {
        if (token && token.length > 10) {
            localStorage.setItem('github_token', token);
            this.githubToken = token;
            console.log('✅ GitHub токен сохранен');
            this.showToast('GitHub токен сохранен!', 'success');
            this.checkGitHubRateLimit();
        } else {
            this.showToast('Неверный токен. Попробуйте снова.', 'warning');
        }
    }
    
    clearGitHubToken() {
        localStorage.removeItem('github_token');
        this.githubToken = null;
        console.log('❌ GitHub токен удален');
        this.showToast('GitHub токен удален. Используется режим без токена (60 запросов/час)', 'info');
        this.updateTokenStatus();
    }
    
    async checkGitHubRateLimit() {
        if (!this.githubToken) {
            this.updateTokenStatus('Без токена', '60 запросов/час');
            return;
        }
        
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
                
                let status = `✅ Токен активен`;
                let details = `${remaining}/${limit} запросов`;
                let color = '#4caf50';
                
                if (remaining < 50) color = '#ff9800';
                if (remaining < 10) color = '#f44336';
                
                this.updateTokenStatus(status, details, color);
                
                if (remaining < 10) {
                    this.showToast(`⚠️ Осталось ${remaining} запросов к GitHub API! Сброс в ${resetTime.toLocaleTimeString()}`, 'warning');
                }
            } else {
                this.updateTokenStatus('⚠️ Токен недействителен', 'Проверьте токен', '#f44336');
                this.clearGitHubToken();
            }
        } catch (error) {
            console.warn('Ошибка проверки токена:', error);
            this.updateTokenStatus('❌ Ошибка проверки', 'Проверьте соединение', '#f44336');
        }
    }
    
    updateTokenStatus(status = null, details = null, color = null) {
        const tokenStatus = document.getElementById('tokenStatus');
        if (!tokenStatus) return;
        
        if (status) {
            tokenStatus.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-size: 11px;">${status}</span>
                    ${details ? `<span style="font-size: 9px; opacity: 0.8;">${details}</span>` : ''}
                </div>
            `;
            if (color) {
                tokenStatus.style.background = `rgba(0,0,0,0.8)`;
                tokenStatus.style.borderLeft = `3px solid ${color}`;
            }
        }
    }
    
    async init() {
        // DOM элементы
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
        
        // Добавляем панель управления токеном
        this.addTokenControlPanel();
        
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
        
        this.renderPlaylist();
        
        // Проверяем статус токена
        await this.checkGitHubRateLimit();
        
        console.log('✅ TV Channel Finder готов');
        
        // Показываем приветственное сообщение
        if (!this.githubToken) {
            this.showToast('💡 Для увеличения лимита до 5000 запросов/час - нажмите "Ввести токен"', 'info');
        }
    }
    
    addTokenControlPanel() {
        // Добавляем панель управления в правый верхний угол
        const header = document.querySelector('.header');
        if (!header) return;
        
        header.style.position = 'relative';
        
        const controlPanel = document.createElement('div');
        controlPanel.id = 'tokenControlPanel';
        controlPanel.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 8px;
            align-items: center;
            z-index: 10;
        `;
        
        // Статус токена
        const tokenStatus = document.createElement('div');
        tokenStatus.id = 'tokenStatus';
        tokenStatus.style.cssText = `
            background: rgba(0,0,0,0.6);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            cursor: pointer;
            transition: all 0.3s;
        `;
        tokenStatus.innerHTML = this.githubToken ? '🔄 Проверка...' : '🔑 Без токена';
        tokenStatus.onclick = () => this.checkGitHubRateLimit();
        
        // Кнопка ввода токена
        const tokenBtn = document.createElement('button');
        tokenBtn.id = 'tokenInputBtn';
        tokenBtn.innerHTML = '<i class="fas fa-key"></i> Ввести токен';
        tokenBtn.style.cssText = `
            background: rgba(255,255,255,0.2);
            border: none;
            padding: 4px 12px;
            border-radius: 12px;
            color: white;
            cursor: pointer;
            font-size: 11px;
            transition: all 0.3s;
        `;
        tokenBtn.onmouseenter = () => tokenBtn.style.background = 'rgba(255,255,255,0.3)';
        tokenBtn.onmouseleave = () => tokenBtn.style.background = 'rgba(255,255,255,0.2)';
        tokenBtn.onclick = () => this.showTokenInputDialog();
        
        // Кнопка удаления токена (показываем только если есть токен)
        if (this.githubToken) {
            const clearTokenBtn = document.createElement('button');
            clearTokenBtn.id = 'clearTokenBtn';
            clearTokenBtn.innerHTML = '<i class="fas fa-trash"></i>';
            clearTokenBtn.style.cssText = `
                background: rgba(255,255,255,0.2);
                border: none;
                padding: 4px 8px;
                border-radius: 12px;
                color: white;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.3s;
            `;
            clearTokenBtn.onclick = () => {
                if (confirm('Удалить сохраненный GitHub токен?')) {
                    this.clearGitHubToken();
                    clearTokenBtn.remove();
                    tokenBtn.innerHTML = '<i class="fas fa-key"></i> Ввести токен';
                }
            };
            controlPanel.appendChild(clearTokenBtn);
        }
        
        controlPanel.appendChild(tokenStatus);
        controlPanel.appendChild(tokenBtn);
        header.appendChild(controlPanel);
    }
    
    showTokenInputDialog() {
        // Создаем модальное окно для ввода токена
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 20000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 20px;
            max-width: 500px;
            width: 90%;
            color: #333;
        `;
        
        dialog.innerHTML = `
            <h2 style="margin-bottom: 20px;">
                <i class="fab fa-github"></i> GitHub Personal Access Token
            </h2>
            <p style="margin-bottom: 15px; color: #666;">
                Токен нужен для увеличения лимита запросов к GitHub API:<br>
                <strong>Без токена:</strong> 60 запросов/час<br>
                <strong>С токеном:</strong> 5000 запросов/час
            </p>
            <input type="password" id="tokenInput" placeholder="Введите GitHub токен" style="
                width: 100%;
                padding: 12px;
                border: 2px solid #e0e0e0;
                border-radius: 8px;
                margin-bottom: 15px;
                font-size: 14px;
            ">
            <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                <button id="saveTokenBtn" style="
                    flex: 1;
                    padding: 12px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">Сохранить токен</button>
                <button id="cancelTokenBtn" style="
                    flex: 1;
                    padding: 12px;
                    background: #f5f5f5;
                    color: #333;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                ">Отмена</button>
            </div>
            <div style="font-size: 12px; color: #888;">
                <p><strong>Как получить токен:</strong></p>
                <ol style="margin-left: 20px;">
                    <li>Перейдите на <a href="https://github.com/settings/tokens" target="_blank">github.com/settings/tokens</a></li>
                    <li>Нажмите "Generate new token (classic)"</li>
                    <li>Выберите права: <code>repo</code>, <code>read:user</code></li>
                    <li>Скопируйте сгенерированный токен</li>
                </ol>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const tokenInput = document.getElementById('tokenInput');
        const saveBtn = document.getElementById('saveTokenBtn');
        const cancelBtn = document.getElementById('cancelTokenBtn');
        
        saveBtn.onclick = () => {
            const token = tokenInput.value.trim();
            if (token) {
                this.saveGitHubToken(token);
                modal.remove();
                // Обновляем интерфейс
                this.addTokenControlPanel(); // Пересоздаем панель
                this.checkGitHubRateLimit();
            } else {
                alert('Введите токен');
            }
        };
        
        cancelBtn.onclick = () => modal.remove();
        
        // Закрытие по клику вне диалога
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        tokenInput.focus();
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
            // Полный поиск как в Python коде
            const channels = await this.fullGitHubSearch(query);
            
            if (channels.length === 0) {
                this.showNoResults(query);
                return;
            }
            
            // Убираем дубликаты
            const unique = this.removeDuplicates(channels);
            
            // Проверяем доступность
            this.searchResults = await this.checkAvailability(unique);
            
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
    
    async fullGitHubSearch(channelName) {
        const searchQueries = [
            `"${channelName}" extension:m3u`,
            `"${channelName}" extension:m3u8`,
            `${channelName} tv extension:m3u`,
            `${channelName} channel extension:m3u`
        ];
        
        let allResults = [];
        const langTerms = this.langModifiers[this.currentLanguage] || this.langModifiers.russian;
        
        this.updateStatus(`Поиск на GitHub (${searchQueries.length * langTerms.length} запросов)...`);
        
        let totalRequests = 0;
        
        for (const query of searchQueries) {
            for (const lang of langTerms) {
                const fullQuery = `${query} ${lang}`;
                totalRequests++;
                this.updateStatus(`Запрос ${totalRequests}: "${fullQuery}"`);
                
                try {
                    const results = await this.searchGitHubCode(fullQuery);
                    allResults.push(...results);
                    console.log(`🔍 GitHub: найдено ${results.length} файлов по "${fullQuery}"`);
                } catch (error) {
                    console.warn(`Ошибка запроса ${fullQuery}:`, error);
                }
                
                // Задержка между запросами
                await this.delay(500);
            }
        }
        
        // Уникальные файлы
        const uniqueFiles = this.uniqueFiles(allResults);
        console.log(`📄 Уникальных файлов для парсинга: ${uniqueFiles.length}`);
        
        // Парсим файлы
        let allChannels = [];
        let parsedCount = 0;
        
        for (const file of uniqueFiles.slice(0, 30)) {
            parsedCount++;
            this.updateStatus(`Парсинг файлов (${parsedCount}/${Math.min(uniqueFiles.length, 30)})...`);
            
            const channels = await this.extractStreamsFromFile(file, channelName);
            allChannels.push(...channels);
            
            await this.delay(300);
        }
        
        console.log(`📡 Всего извлечено потоков: ${allChannels.length}`);
        return allChannels;
    }
    
    async searchGitHubCode(query) {
        const url = `${this.githubApiUrl}/search/code?q=${encodeURIComponent(query)}&per_page=30`;
        
        const headers = {};
        if (this.githubToken) {
            headers['Authorization'] = `token ${this.githubToken}`;
        }
        
        const response = await fetch(url, { headers });
        
        if (response.status === 403) {
            const resetTime = response.headers.get('X-RateLimit-Reset');
            if (resetTime) {
                const waitTime = new Date(resetTime * 1000) - Date.now();
                throw new Error(`Лимит GitHub API. Подождите ${Math.ceil(waitTime / 60000)} минут`);
            }
            throw new Error('Превышен лимит запросов к GitHub API');
        }
        
        if (response.status !== 200) {
            return [];
        }
        
        const data = await response.json();
        return data.items || [];
    }
    
    uniqueFiles(files) {
        const unique = new Map();
        for (const file of files) {
            const key = `${file.repository.full_name}_${file.path}`;
            if (!unique.has(key)) {
                unique.set(key, file);
            }
        }
        return Array.from(unique.values());
    }
    
    async extractStreamsFromFile(fileInfo, searchQuery) {
        const channels = [];
        
        try {
            const rawUrl = fileInfo.url
                .replace('api.github.com/repos', 'raw.githubusercontent.com')
                .replace('/contents/', '/');
            
            const response = await fetch(rawUrl);
            if (!response.ok) return channels;
            
            const content = await response.text();
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line.startsWith('#EXTINF:')) {
                    if (line.toLowerCase().includes(searchQuery.toLowerCase())) {
                        let name = this.extractNameFromExtinf(line);
                        const group = this.extractGroup(line);
                        
                        let url = null;
                        let j = i + 1;
                        while (j < lines.length && j < i + 5) {
                            const potentialUrl = lines[j].trim();
                            if (potentialUrl && !potentialUrl.startsWith('#') && potentialUrl.startsWith('http')) {
                                if (!potentialUrl.includes('github.com') && 
                                    !potentialUrl.includes('raw.githubusercontent.com')) {
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
                                group: group || 'Неизвестно',
                                source: fileInfo.repository.full_name,
                                file: fileInfo.path
                            });
                        }
                    }
                }
            }
            
            if (channels.length > 0) {
                console.log(`📄 ${fileInfo.path}: найдено ${channels.length} каналов`);
            }
            
        } catch (error) {
            console.warn(`Ошибка парсинга файла:`, error);
        }
        
        return channels;
    }
    
    extractNameFromExtinf(line) {
        const tvgMatch = line.match(/tvg-name="([^"]*)"/);
        if (tvgMatch && tvgMatch[1]) {
            return tvgMatch[1];
        }
        
        const commaMatch = line.match(/,([^,]+)$/);
        if (commaMatch) {
            return commaMatch[1].trim();
        }
        
        return 'Unknown';
    }
    
    extractGroup(line) {
        const groupMatch = line.match(/group-title="([^"]*)"/);
        return groupMatch ? groupMatch[1] : null;
    }
    
    cleanName(name) {
        return name
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?\)/g, '')
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
        const total = Math.min(channels.length, 30);
        
        this.updateStatus(`Проверка доступности потоков...`);
        
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
            
            await this.delay(200);
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
    
    renderResults(channels) {
        this.resultsCount.textContent = `${channels.length} рабочих источников`;
        
        const html = channels.map((channel, index) => `
            <div class="result-card" data-url="${channel.url}">
                <div class="result-header">
                    <div class="result-name">
                        <i class="fas fa-tv"></i> 
                        ${this.escapeHtml(channel.name)}
                        ${channel.source ? `<span style="font-size: 11px; color: #888;"> (${this.escapeHtml(channel.source.split('/')[0])})</span>` : ''}
                    </div>
                    <div class="result-status">
                        <i class="fas fa-check-circle"></i> Работает
                    </div>
                </div>
                <div class="result-url">
                    <i class="fas fa-tag"></i> ${this.escapeHtml(channel.group || 'Без группы')}<br>
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
                <p>🔍 Поиск каналов на GitHub...</p>
                <small style="color: #888; margin-top: 10px; display: block;">
                    Поиск по всему GitHub (${this.githubToken ? 'с токеном ✅' : 'без токена ⚠️'})
                </small>
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
        console.log('Статус:', message);
    }
    
    updateProgress(current, total, itemName) {
        this.resultsCount.textContent = `Проверка: ${current}/${total}`;
        
        const loadingDiv = this.resultsContainer.querySelector('.loading');
        if (loadingDiv && current <= total) {
            loadingDiv.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <p>Проверка доступности потоков...</p>
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
                <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; text-align: left;">
                    <p><strong>💡 Возможные причины:</strong></p>
                    <ul style="margin-top: 10px;">
                        <li>• Неверное написание названия</li>
                        <li>• Канал действительно не найден в публичных плейлистах</li>
                        ${!this.githubToken ? '<li>• <strong>Вы без GitHub токена</strong> (60 запросов/час). Нажмите "Ввести токен" для увеличения лимита</li>' : ''}
                    </ul>
                </div>
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
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Обновить страницу
                </button>
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
            white-space: nowrap;
            font-size: 14px;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
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
