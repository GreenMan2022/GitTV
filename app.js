// ============== TV CHANNEL SEARCHER - ПОЛНАЯ КОПИЯ PYTHON ВЕРСИИ ==============

class TVChannelSearcher {
    constructor(githubToken = null) {
        this.githubToken = githubToken;
        this.session = null;
        this.searchResults = [];
        this.isSearching = false;
        
        // Языковые модификаторы (как в Python)
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
                if (this.searchInput.value.trim()) {
                    this.searchChannel();
                }
            });
        });
        
        this.clearPlaylistBtn.addEventListener('click', () => this.clearPlaylist());
        this.closePreview.addEventListener('click', () => this.closePreviewModal());
        
        this.renderPlaylist();
        
        // Загружаем плейлист
        this.playlist = this.loadPlaylist();
        
        console.log('✅ TV Channel Searcher готов (как Python версия)');
        this.showToast('Введите название канала (СТС, ТНТ, Первый...)', 'info');
    }
    
    // ============== ОСНОВНЫЕ МЕТОДЫ (ТОЧНО КАК В PYTHON) ==============
    
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
        
        // Определяем текущий язык
        const activeLangBtn = document.querySelector('.lang-btn.active');
        let language = 'russian';
        if (activeLangBtn) {
            const langMap = {
                '🇷🇺 Русский': 'russian',
                '🇬🇧 English': 'english',
                '🇩🇪 Deutsch': 'german',
                '🇫🇷 Français': 'french'
            };
            language = langMap[activeLangBtn.textContent] || 'russian';
        }
        
        this.isSearching = true;
        this.showLoading();
        
        try {
            // Метод search_and_verify_channels из Python
            const results = await this.searchAndVerifyChannels(channelName, language);
            
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
    
    // search_channel_by_name - точная копия Python метода
    async searchChannelByName(channelName, language) {
        const searchQueries = [
            `"${channelName}" extension:m3u`,
            `"${channelName}" extension:m3u8`,
            `${channelName} tv extension:m3u`,
            `${channelName} channel extension:m3u`
        ];
        
        const langModifiers = this.langModifiers[language] || this.langModifiers.russian;
        const allResults = [];
        
        for (const query of searchQueries) {
            for (const lang of langModifiers) {
                const fullQuery = `${query} ${lang}`;
                const url = `https://api.github.com/search/code?q=${encodeURIComponent(fullQuery)}&per_page=30`;
                
                try {
                    const headers = {};
                    if (this.githubToken) {
                        headers['Authorization'] = `token ${this.githubToken}`;
                    }
                    
                    const response = await fetch(url, { headers });
                    
                    if (response.status === 200) {
                        const data = await response.json();
                        const items = data.items || [];
                        allResults.push(...items);
                        console.log(`🔍 По запросу "${fullQuery}" найдено: ${items.length} файлов`);
                    } else if (response.status === 403) {
                        console.warn(`⚠️ Лимит API для запроса: ${fullQuery}`);
                    }
                } catch (error) {
                    console.error(`Ошибка запроса ${fullQuery}:`, error);
                }
                
                // Задержка между запросами
                await this.delay(500);
            }
        }
        
        // Удаляем дубликаты (как в Python)
        const uniqueResults = {};
        for (const item of allResults) {
            const key = `${item.repository.full_name}_${item.path}`;
            if (!uniqueResults[key]) {
                uniqueResults[key] = item;
            }
        }
        
        return Object.values(uniqueResults);
    }
    
    // extract_stream_urls_from_file - точная копия Python метода
    async extractStreamUrlsFromFile(repoName, filePath, channelName) {
        const url = `https://api.github.com/repos/${repoName}/contents/${filePath}`;
        
        try {
            const headers = {};
            if (this.githubToken) {
                headers['Authorization'] = `token ${this.githubToken}`;
            }
            
            const response = await fetch(url, { headers });
            
            if (response.status === 200) {
                const data = await response.json();
                const content = atob(data.content);
                const lines = content.split('\n');
                
                const foundChannels = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    if (line.includes('#EXTINF:') && line.toLowerCase().includes(channelName.toLowerCase())) {
                        if (i + 1 < lines.length) {
                            const streamUrl = lines[i + 1].trim();
                            
                            // Проверяем, что это реальный URL
                            if (streamUrl && !streamUrl.startsWith('#')) {
                                // Пропускаем ссылки на GitHub
                                if (!streamUrl.includes('github.com') && !streamUrl.includes('raw.githubusercontent.com')) {
                                    
                                    // Проверяем, что URL похож на поток
                                    const streamExtensions = ['.m3u8', '.ts', '.mpd', '.m3u', 'stream', 'live', 'playlist'];
                                    const isValidStream = streamExtensions.some(ext => streamUrl.toLowerCase().includes(ext));
                                    
                                    if (isValidStream) {
                                        // Извлекаем название
                                        const nameMatch = line.match(/,([^,]+)$/);
                                        const channelTitle = nameMatch ? nameMatch[1].trim() : "Unknown";
                                        
                                        // Извлекаем группу
                                        const groupMatch = line.match(/group-title="([^"]*)"/);
                                        const group = groupMatch ? groupMatch[1] : "No group";
                                        
                                        // Извлекаем логотип
                                        const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                                        const logo = logoMatch ? logoMatch[1] : "";
                                        
                                        foundChannels.push({
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
                    }
                }
                
                return foundChannels;
            }
        } catch (error) {
            console.warn(`Ошибка чтения файла ${filePath}:`, error);
        }
        
        return null;
    }
    
    // check_stream_availability - точная копия Python метода
    async checkStreamAvailability(url, timeout = 5000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            // Пробуем HEAD запрос
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            
            clearTimeout(timeoutId);
            
            if ([200, 206, 302, 301].includes(response.status)) {
                return { available: true, statusCode: response.status, message: "Доступен" };
            }
            
            // Если HEAD не работает, пробуем GET с диапазоном
            if (response.status === 405) {
                const getResponse = await fetch(url, {
                    headers: { 'Range': 'bytes=0-1', 'User-Agent': 'Mozilla/5.0' }
                });
                if ([200, 206].includes(getResponse.status)) {
                    return { available: true, statusCode: getResponse.status, message: "Доступен (GET)" };
                }
            }
            
            return { available: false, statusCode: response.status, message: `Ошибка ${response.status}` };
            
        } catch (error) {
            if (error.name === 'AbortError') {
                return { available: false, statusCode: 0, message: "Таймаут" };
            }
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                return { available: false, statusCode: 0, message: "Ошибка соединения" };
            }
            return { available: false, statusCode: 0, message: `Ошибка: ${error.message.substring(0, 30)}` };
        }
    }
    
    // search_and_verify_channels - точная копия Python метода
    async searchAndVerifyChannels(channelName, language, maxFiles = 50, maxWorkers = 5, verifyOnlyWorking = true) {
        console.log(`\n🔍 Поиск потоков для канала '${channelName}'...`);
        this.updateStatus(`Поиск файлов на GitHub...`);
        
        // Поиск файлов
        const files = await this.searchChannelByName(channelName, language);
        
        if (files.length === 0) {
            console.log("❌ Файлы с каналом не найдены");
            return [];
        }
        
        console.log(`📄 Найдено ${files.length} потенциальных файлов. Извлекаем URL...`);
        this.updateStatus(`Найдено ${files.length} файлов, извлекаем URL...`);
        
        // Извлекаем URL из файлов
        const allPotentialStreams = [];
        const filesToCheck = files.slice(0, maxFiles);
        
        for (const fileInfo of filesToCheck) {
            const repoName = fileInfo.repository.full_name;
            const filePath = fileInfo.path;
            const streams = await this.extractStreamUrlsFromFile(repoName, filePath, channelName);
            if (streams && streams.length > 0) {
                allPotentialStreams.push(...streams);
            }
            await this.delay(300);
        }
        
        if (allPotentialStreams.length === 0) {
            console.log("❌ Не найдено URL потоков");
            return [];
        }
        
        console.log(`📡 Найдено ${allPotentialStreams.length} потенциальных потоков. Проверяем доступность...`);
        this.updateStatus(`Проверка доступности ${allPotentialStreams.length} потоков...`);
        
        // Проверяем доступность потоков
        const verifiedStreams = [];
        let checked = 0;
        
        for (const stream of allPotentialStreams) {
            const { available, statusCode, message } = await this.checkStreamAvailability(stream.url);
            checked++;
            
            stream.checked = true;
            stream.is_working = available;
            stream.status_code = statusCode;
            stream.check_message = message;
            
            if (verifyOnlyWorking) {
                if (available) {
                    verifiedStreams.push(stream);
                    console.log(`✅ [${checked}/${allPotentialStreams.length}] ${stream.name} - ДОСТУПЕН`);
                } else {
                    console.log(`❌ [${checked}/${allPotentialStreams.length}] ${stream.name} - ${message}`);
                }
            } else {
                verifiedStreams.push(stream);
                if (available) {
                    console.log(`✅ [${checked}/${allPotentialStreams.length}] ${stream.name} - ДОСТУПЕН`);
                } else {
                    console.log(`⚠️ [${checked}/${allPotentialStreams.length}] ${stream.name} - ${message}`);
                }
            }
            
            this.updateProgress(checked, allPotentialStreams.length, stream.name);
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
        } else if (this.previewPlayer.canPlayType('application/vnd.apple.mpegurl')) {
            this.previewPlayer.src = channel.url;
            this.previewPlayer.play().catch(e => console.log('Autoplay blocked'));
        } else {
            this.showToast('Формат не поддерживается', 'warning');
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
        const container = this.playlistContainer;
        
        if (playlist.length === 0) {
            container.innerHTML = `
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
        
        container.innerHTML = html;
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
                <p>🔍 Поиск файлов на GitHub...</p>
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
                <p style="font-size: 12px; color: #888; max-width: 80%; margin: 10px auto;">${itemName || ''}</p>
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
                    <p><strong>💡 Советы (как в Python версии):</strong></p>
                    <ul style="margin-top: 10px;">
                        <li>• Попробуйте другие названия (СТС, ТНТ, Россия 1)</li>
                        <li>• Ищите на английском (STS, TNT, Russia 1)</li>
                        <li>• Добавьте GitHub токен для увеличения лимита</li>
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
