// ============== TV CHANNEL SEARCHER - ПОЛНАЯ РАБОЧАЯ ВЕРСИЯ ==============

class TVChannelSearcher {
    constructor(githubToken = null) {
        this.githubToken = githubToken;
        this.searchResults = [];
        this.isSearching = false;
        this.currentLanguage = 'russian';
        
        // Языковые модификаторы
        this.langModifiers = {
            russian: ["ru", "russian", "россия"],
            english: ["en", "english", "usa"],
            german: ["de", "german"],
            french: ["fr", "french"]
        };
        
        this.init();
    }
    
    init() {
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
        this.searchBtn.addEventListener('click', () => this.searchChannel());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchChannel();
        });
        
        this.langBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.langBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const langMap = {
                    '🇷🇺 Русский': 'russian',
                    '🇬🇧 English': 'english',
                    '🇩🇪 Deutsch': 'german',
                    '🇫🇷 Français': 'french'
                };
                this.currentLanguage = langMap[btn.textContent] || 'russian';
                
                if (this.searchInput.value.trim()) {
                    this.searchChannel();
                }
            });
        });
        
        this.clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());
        this.closePreview.addEventListener('click', () => this.closePreviewModal());
        
        this.renderPlaylist();
        
        console.log('✅ TV Channel Finder готов');
        this.showToast('Введите название канала (СТС, ТНТ, Первый...)', 'info');
    }
    
    // ============== ОСНОВНЫЕ МЕТОДЫ ПОИСКА ==============
    
    async searchChannel() {
        if (this.isSearching) {
            this.showToast('Поиск уже выполняется...', 'warning');
            return;
        }
        
        const channelName = this.searchInput.value.trim();
        if (!channelName) {
            this.showToast('Введите название канала', 'warning');
            return;
        }
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            const results = await this.searchAndVerifyChannels(channelName);
            
            if (results.length === 0) {
                this.showNoResults(channelName);
                return;
            }
            
            this.searchResults = results;
            this.renderResults(results);
            
            const workingCount = results.filter(r => r.is_working).length;
            this.showToast(`✅ Найдено ${workingCount} рабочих потоков для "${channelName}"`, 'success');
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            this.showError('Ошибка: ' + error.message);
        } finally {
            this.isSearching = false;
        }
    }
    
    async searchAndVerifyChannels(channelName) {
        console.log(`\n🔍 Поиск потоков для канала '${channelName}'...`);
        this.updateStatus(`Поиск файлов на GitHub...`);
        
        // Поиск файлов
        const files = await this.searchChannelByName(channelName);
        
        if (files.length === 0) {
            console.log("❌ Файлы с каналом не найдены");
            return [];
        }
        
        console.log(`📄 Найдено ${files.length} потенциальных файлов. Извлекаем URL...`);
        this.updateStatus(`Найдено ${files.length} файлов, извлекаем URL...`);
        
        // Извлекаем URL из файлов
        const allPotentialStreams = [];
        const filesToCheck = files.slice(0, 15); // Не больше 15 файлов
        
        for (let i = 0; i < filesToCheck.length; i++) {
            const fileInfo = filesToCheck[i];
            this.updateStatus(`Анализ файла ${i+1}/${filesToCheck.length}...`);
            
            const streams = await this.extractStreamsFromFile(fileInfo, channelName);
            if (streams && streams.length > 0) {
                allPotentialStreams.push(...streams);
            }
            
            await this.delay(500);
        }
        
        if (allPotentialStreams.length === 0) {
            console.log("❌ Не найдено URL потоков");
            return [];
        }
        
        console.log(`📡 Найдено ${allPotentialStreams.length} потенциальных потоков. Проверяем доступность...`);
        this.updateStatus(`Проверка доступности ${allPotentialStreams.length} потоков...`);
        
        // Проверяем доступность потоков
        const verifiedStreams = [];
        
        for (let i = 0; i < allPotentialStreams.length; i++) {
            const stream = allPotentialStreams[i];
            const result = await this.checkStreamAvailability(stream.url);
            
            stream.checked = true;
            stream.is_working = result.available;
            stream.status_code = result.statusCode;
            stream.check_message = result.message;
            
            if (result.available) {
                verifiedStreams.push(stream);
                console.log(`✅ [${i+1}/${allPotentialStreams.length}] ${stream.name} - ДОСТУПЕН`);
            } else {
                console.log(`❌ [${i+1}/${allPotentialStreams.length}] ${stream.name} - ${result.message}`);
            }
            
            this.updateProgress(i+1, allPotentialStreams.length, stream.name);
            await this.delay(200);
        }
        
        // Удаляем дубликаты URL
        const uniqueStreams = {};
        for (const stream of verifiedStreams) {
            if (!uniqueStreams[stream.url]) {
                uniqueStreams[stream.url] = stream;
            }
        }
        
        return Object.values(uniqueStreams);
    }
    
    async searchChannelByName(channelName) {
        const searchQueries = [
            `"${channelName}" extension:m3u`,
            `"${channelName}" extension:m3u8`,
            `${channelName} tv extension:m3u`,
            `${channelName} channel extension:m3u`
        ];
        
        const langModifiers = this.langModifiers[this.currentLanguage] || this.langModifiers.russian;
        const allResults = [];
        
        for (const query of searchQueries) {
            for (const lang of langModifiers) {
                const fullQuery = `${query} ${lang}`;
                const url = `https://api.github.com/search/code?q=${encodeURIComponent(fullQuery)}&per_page=30`;
                
                try {
                    console.log(`🔍 GitHub запрос: ${fullQuery}`);
                    
                    const headers = {};
                    if (this.githubToken) {
                        headers['Authorization'] = `token ${this.githubToken}`;
                    }
                    headers['Accept'] = 'application/vnd.github.v3+json';
                    
                    const response = await fetch(url, { headers });
                    
                    if (response.status === 200) {
                        const data = await response.json();
                        const items = data.items || [];
                        allResults.push(...items);
                        console.log(`✅ Найдено ${items.length} файлов`);
                    } else if (response.status === 403) {
                        console.warn(`⚠️ Лимит API, ждем...`);
                        await this.delay(60000);
                    } else {
                        console.log(`❌ Статус ${response.status}`);
                    }
                    
                } catch (error) {
                    console.error(`Ошибка запроса:`, error);
                }
                
                await this.delay(600);
            }
        }
        
        // Удаляем дубликаты
        const uniqueResults = {};
        for (const item of allResults) {
            const key = `${item.repository.full_name}_${item.path}`;
            if (!uniqueResults[key]) {
                uniqueResults[key] = item;
            }
        }
        
        return Object.values(uniqueResults);
    }
    
    async extractStreamsFromFile(fileInfo, searchQuery) {
        const channels = [];
        
        try {
            // ПРАВИЛЬНОЕ формирование URL для raw.githubusercontent.com
            const repoName = fileInfo.repository.full_name;
            const filePath = fileInfo.path;
            const rawUrl = `https://raw.githubusercontent.com/${repoName}/${filePath}`;
            
            console.log(`📥 Загрузка: ${rawUrl.substring(0, 80)}...`);
            
            const response = await fetch(rawUrl);
            
            if (!response.ok) {
                console.warn(`❌ Ошибка ${response.status}`);
                return channels;
            }
            
            const content = await response.text();
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.includes('#EXTINF:') && line.toLowerCase().includes(searchQuery.toLowerCase())) {
                    if (i + 1 < lines.length) {
                        const streamUrl = lines[i + 1].trim();
                        
                        if (streamUrl && !streamUrl.startsWith('#') && 
                            !streamUrl.includes('github.com') && 
                            !streamUrl.includes('raw.githubusercontent.com') &&
                            streamUrl.startsWith('http')) {
                            
                            const nameMatch = line.match(/,([^,]+)$/);
                            const channelTitle = nameMatch ? nameMatch[1].trim() : "Unknown";
                            const groupMatch = line.match(/group-title="([^"]*)"/);
                            const group = groupMatch ? groupMatch[1] : "No group";
                            const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                            const logo = logoMatch ? logoMatch[1] : "";
                            
                            channels.push({
                                name: channelTitle,
                                url: streamUrl,
                                group: group,
                                logo: logo,
                                source_repo: repoName,
                                source_file: filePath
                            });
                        }
                    }
                }
            }
            
            if (channels.length > 0) {
                console.log(`✅ Найдено ${channels.length} каналов`);
            }
            
        } catch (error) {
            console.warn(`❌ Ошибка парсинга:`, error.message);
        }
        
        return channels;
    }
    
    async checkStreamAvailability(url, timeout = 5000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if ([200, 206, 302, 301].includes(response.status)) {
                return { available: true, statusCode: response.status, message: "Доступен" };
            }
            
            return { available: false, statusCode: response.status, message: `Ошибка ${response.status}` };
            
        } catch (error) {
            if (error.name === 'AbortError') {
                return { available: false, statusCode: 0, message: "Таймаут" };
            }
            return { available: false, statusCode: 0, message: "Ошибка соединения" };
        }
    }
    
    // ============== UI МЕТОДЫ ==============
    
    renderResults(channels) {
        const workingChannels = channels.filter(c => c.is_working);
        this.resultsCount.textContent = `${workingChannels.length} рабочих источников`;
        
        if (workingChannels.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="placeholder">
                    <i class="fas fa-search"></i>
                    <p>Рабочих потоков не найдено</p>
                </div>
            `;
            return;
        }
        
        const html = workingChannels.map((channel, index) => `
            <div class="result-card" data-url="${channel.url}">
                <div class="result-header">
                    <div class="result-name">
                        <i class="fas fa-tv"></i> 
                        ${this.escapeHtml(channel.name)}
                        <span style="font-size: 11px; color: #888;"> (${channel.source_repo.split('/')[0]})</span>
                    </div>
                    <div class="result-status">
                        <i class="fas fa-check-circle"></i> Работает
                    </div>
                </div>
                <div class="result-url">
                    <i class="fas fa-tag"></i> ${this.escapeHtml(channel.group)}<br>
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
        const workingChannels = this.searchResults.filter(c => c.is_working);
        const channel = workingChannels[index];
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
        const workingChannels = this.searchResults.filter(c => c.is_working);
        const channel = workingChannels[index];
        if (!channel) return;
        
        const playlist = this.loadPlaylist();
        
        if (playlist.some(item => item.url === channel.url)) {
            this.showToast('Канал уже в плейлисте', 'info');
            return;
        }
        
        playlist.push({
            id: Date.now(),
            name: channel.name,
            url: channel.url,
            group: channel.group,
            addedAt: new Date().toISOString()
        });
        
        this.savePlaylist(playlist);
        this.renderPlaylist();
        this.showToast(`✅ "${channel.name}" добавлен в плейлист`, 'success');
    }
    
    renderPlaylist() {
        const playlist = this.loadPlaylist();
        
        if (playlist.length === 0) {
            this.playlistContainer.innerHTML = `
                <div class="empty-playlist">
                    <i class="fas fa-plus-circle"></i>
                    <p>Добавьте каналы из результатов поиска</p>
                </div>
            `;
            return;
        }
        
        const html = playlist.map((item, index) => `
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
                    <button class="play-btn" onclick="app.playFromPlaylist(${index})" title="Смотреть">
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
    
    playFromPlaylist(index) {
        const playlist = this.loadPlaylist();
        const channel = playlist[index];
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
    
    removeFromPlaylist(index) {
        const playlist = this.loadPlaylist();
        const channel = playlist[index];
        playlist.splice(index, 1);
        this.savePlaylist(playlist);
        this.renderPlaylist();
        this.showToast(`❌ "${channel.name}" удален из плейлиста`, 'info');
    }
    
    clearPlaylist() {
        if (confirm('Очистить весь плейлист?')) {
            this.savePlaylist([]);
            this.renderPlaylist();
            this.showToast('Плейлист очищен', 'info');
        }
    }
    
    loadPlaylist() {
        const saved = localStorage.getItem('tv_playlist');
        return saved ? JSON.parse(saved) : [];
    }
    
    savePlaylist(playlist) {
        localStorage.setItem('tv_playlist', JSON.stringify(playlist));
    }
    
    // ============== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==============
    
    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>🔍 Поиск каналов на GitHub...</p>
                <small style="color: #888; margin-top: 10px; display: block;">
                    Выполняется поиск по всему GitHub
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
        console.log('📡', message);
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
    
    showNoResults(channelName) {
        this.resultsContainer.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-search"></i>
                <h3>Каналы не найдены</h3>
                <p>По запросу "${this.escapeHtml(channelName)}" ничего не найдено</p>
                <div style="margin-top: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; text-align: left;">
                    <p><strong>💡 Советы:</strong></p>
                    <ul style="margin-top: 10px;">
                        <li>• Попробуйте другие названия (СТС, ТНТ, Россия 1)</li>
                        <li>• Ищите на английском (STS, TNT, Russia 1)</li>
                        <li>• Подождите 5-10 минут если был лимит</li>
                    </ul>
                </div>
            </div>
        `;
        this.resultsCount.textContent = '0 источников';
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
            font-size: 14px;
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

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TVChannelSearcher();
});
