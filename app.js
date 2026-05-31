// ============== TV CHANNEL FINDER - ПОЛНЫЙ ПОИСК КАК В PYTHON ==============

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
        
        // Языковые модификаторы (как в Python)
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
                'С токеном - 5000 запросов/час\n\n' +
                'Можно нажать Отмена для демо-режима'
            );
            if (token && token.length > 10) {
                localStorage.setItem('github_token', token);
            }
        }
        return token;
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
        
        console.log('✅ TV Channel Finder готов (полный поиск как в Python)');
        this.showToast('Введите название канала - поиск по всему GitHub', 'info');
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
        // Точное как в Python коде
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
                
                // Задержка между запросами (важно для лимитов)
                await this.delay(500);
            }
        }
        
        // Уникальные файлы
        const uniqueFiles = this.uniqueFiles(allResults);
        console.log(`📄 Уникальных файлов для парсинга: ${uniqueFiles.length}`);
        
        // Парсим файлы
        let allChannels = [];
        let parsedCount = 0;
        
        for (const file of uniqueFiles.slice(0, 30)) { // Максимум 30 файлов
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
            // Превышен лимит
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
            // Получаем содержимое файла
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
                    // Проверяем, есть ли название канала в строке
                    if (line.toLowerCase().includes(searchQuery.toLowerCase())) {
                        // Извлекаем название
                        let name = this.extractNameFromExtinf(line);
                        
                        // Извлекаем группу
                        const group = this.extractGroup(line);
                        
                        // Ищем URL на следующих строках
                        let url = null;
                        let j = i + 1;
                        while (j < lines.length && j < i + 5) {
                            const potentialUrl = lines[j].trim();
                            if (potentialUrl && !potentialUrl.startsWith('#') && potentialUrl.startsWith('http')) {
                                // Пропускаем ссылки на GitHub
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
        // Пробуем tvg-name
        const tvgMatch = line.match(/tvg-name="([^"]*)"/);
        if (tvgMatch && tvgMatch[1]) {
            return tvgMatch[1];
        }
        
        // Пробуем после запятой
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
                    <small style="color: #888; margin-top: 10px; display: block;">
                        Поиск работает как в Python - по всему GitHub
                    </small>
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
                    Выполняется поиск по всему GitHub (как в Python версии)
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
                    <p><strong>💡 Советы как в Python версии:</strong></p>
                    <ul style="margin-top: 10px;">
                        <li>• Проверьте правильность написания</li>
                        <li>• Используйте короткое название (например "ТНТ")</li>
                        <li>• Попробуйте английское название (например "TNT")</li>
                        <li>• Смените язык поиска</li>
                        <li>• Добавьте GitHub токен для большего лимита</li>
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
