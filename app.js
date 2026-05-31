// ============== TV CHANNEL FINDER - ГИБРИДНЫЙ ПОИСК ==============
// Быстрый поиск в готовых плейлистах + GitHub API как резерв

class TVChannelFinder {
    constructor() {
        // Готовые проверенные источники плейлистов
        this.playlists = {
            russian: [
                { name: 'IPTV-ORG Россия', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ru.m3u' },
                { name: 'Free-IPTV Россия', url: 'https://raw.githubusercontent.com/Free-IPTV/IPTV/master/playlists/ru.m3u' },
                { name: 'EgorMKN Россия', url: 'https://raw.githubusercontent.com/egormkn/iptv/master/playlist.m3u' },
                { name: 'IPTV-Russia', url: 'https://raw.githubusercontent.com/AndreyGuzhov/IPTV/master/playlist.m3u' }
            ],
            english: [
                { name: 'IPTV-ORG USA', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us.m3u' },
                { name: 'IPTV-ORG UK', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/gb.m3u' },
                { name: 'Free-IPTV World', url: 'https://raw.githubusercontent.com/Free-IPTV/IPTV/master/playlists/world.m3u' }
            ],
            german: [
                { name: 'IPTV-ORG Германия', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/de.m3u' }
            ],
            french: [
                { name: 'IPTV-ORG Франция', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/fr.m3u' }
            ],
            arabic: [
                { name: 'IPTV-ORG Арабский', url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/ar.m3u' }
            ]
        };
        
        // Кэш для загруженных плейлистов
        this.cache = new Map();
        this.currentLanguage = 'russian';
        this.searchResults = [];
        this.playlist = this.loadPlaylist();
        this.isSearching = false;
        
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
        
        console.log('✅ TV Channel Finder готов к работе');
        this.showToast('Введите название канала (СТС, ТНТ, CNN, BBC...)', 'info');
        
        // Предзагружаем популярные плейлисты в фоне
        this.preloadPlaylists();
    }
    
    async preloadPlaylists() {
        console.log('📦 Предзагрузка плейлистов...');
        const ruPlaylists = this.playlists.russian;
        
        for (const playlist of ruPlaylists.slice(0, 2)) { // Загружаем только 2 для скорости
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
            // 1. Поиск в готовых плейлистах
            let channels = await this.searchInPlaylists(query);
            
            // 2. Если не нашли, пробуем GitHub
            if (channels.length === 0) {
                this.updateStatus('Поиск на GitHub...');
                channels = await this.searchOnGitHub(query);
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
                this.showToast('Потоки найдены, но все недоступны. Попробуйте другой канал.', 'warning');
                this.showNoResults(query);
                return;
            }
            
            // 5. Показываем результаты
            this.renderResults(this.searchResults);
            this.showToast(`✅ Найдено ${this.searchResults.length} рабочих потоков для "${query}"`, 'success');
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            this.showError('Ошибка при поиске: ' + error.message);
        } finally {
            this.isSearching = false;
        }
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
                // Загружаем или берем из кэша
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
                
                // Ищем совпадения
                const matches = channels.filter(ch => 
                    ch.name.toLowerCase().includes(queryLower) ||
                    this.isSimilar(ch.name.toLowerCase(), queryLower)
                );
                
                if (matches.length > 0) {
                    console.log(`✅ Найдено ${matches.length} каналов в ${playlist.name}`);
                    allMatches.push(...matches.map(ch => ({
                        ...ch,
                        playlist: playlist.name,
                        source: playlist.name
                    })));
                }
                
            } catch (error) {
                console.warn(`Ошибка загрузки ${playlist.name}:`, error);
            }
            
            // Небольшая задержка между запросами
            await this.delay(200);
        }
        
        return allMatches;
    }
    
    async searchOnGitHub(query) {
        const channels = [];
        const queryLower = query.toLowerCase();
        
        // Альтернативные GitHub источники
        const githubSources = [
            `https://raw.githubusercontent.com/iptv-org/iptv/master/streams/${this.getLangCode()}.m3u`,
            `https://raw.githubusercontent.com/Free-IPTV/IPTV/master/playlists/${this.getLangCode()}.m3u`,
            'https://raw.githubusercontent.com/azimut/iptv/main/playlist.m3u'
        ];
        
        this.updateStatus('Поиск на GitHub...');
        
        for (const url of githubSources) {
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const content = await response.text();
                    const parsed = this.parseM3U(content, 'GitHub');
                    const matches = parsed.filter(ch => 
                        ch.name.toLowerCase().includes(queryLower)
                    );
                    
                    if (matches.length > 0) {
                        console.log(`✅ Найдено ${matches.length} каналов на GitHub`);
                        channels.push(...matches.map(ch => ({
                            ...ch,
                            source: 'GitHub',
                            playlist: 'GitHub'
                        })));
                    }
                }
            } catch (error) {
                console.warn(`Ошибка GitHub поиска:`, error);
            }
        }
        
        return channels;
    }
    
    parseM3U(content, playlistName) {
        const channels = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('#EXTINF:')) {
                // Извлекаем название
                let name = this.extractChannelName(line);
                if (!name || name === 'Unknown') continue;
                
                // Извлекаем группу
                const group = this.extractGroup(line);
                
                // Извлекаем логотип
                const logo = this.extractLogo(line);
                
                // Ищем URL на следующих строках
                let url = null;
                let j = i + 1;
                while (j < lines.length && !lines[j].trim().startsWith('#EXTINF:') && j < i + 5) {
                    const potentialUrl = lines[j].trim();
                    if (potentialUrl && !potentialUrl.startsWith('#') && potentialUrl.startsWith('http')) {
                        if (!potentialUrl.includes('github.com') && !potentialUrl.includes('raw.githubusercontent.com')) {
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
                        logo: logo,
                        playlist: playlistName
                    });
                }
            }
        }
        
        return channels;
    }
    
    extractChannelName(line) {
        // Пробуем разные варианты извлечения имени
        let name = null;
        
        // 1. tvg-name
        const tvgMatch = line.match(/tvg-name="([^"]*)"/);
        if (tvgMatch && tvgMatch[1]) {
            name = tvgMatch[1];
        }
        
        // 2. После последней запятой
        if (!name) {
            const commaMatch = line.match(/,([^,]+)$/);
            if (commaMatch) {
                name = commaMatch[1].trim();
            }
        }
        
        // 3. Очистка от мусора
        if (name) {
            name = name.replace(/\[.*?\]/g, '')
                       .replace(/\(.*?\)/g, '')
                       .replace(/\s+/g, ' ')
                       .trim();
        }
        
        return name || 'Unknown';
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
        // Убираем лишние символы и нормализуем
        return name
            .replace(/HD|SD|FHD|4K|\([^)]*\)|\[[^\]]*\]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    isSimilar(str1, str2) {
        // Простая проверка на схожесть для латиницы/кириллицы
        const translit = {
            'c': 'с', 't': 'т', 'c': 'с', 't': 'т', 's': 'с', 't': 'т', 'c': 'с',
            'sts': 'стс', 'tnt': 'тнт', 'russia': 'россия', 'russian': 'русский'
        };
        
        let s1 = str1.toLowerCase();
        let s2 = str2.toLowerCase();
        
        // Прямое совпадение
        if (s1.includes(s2) || s2.includes(s1)) return true;
        
        // Транслитерация
        for (const [eng, rus] of Object.entries(translit)) {
            if (s1.includes(eng) && s2.includes(rus)) return true;
            if (s1.includes(rus) && s2.includes(eng)) return true;
        }
        
        return false;
    }
    
    getLangCode() {
        const codes = {
            russian: 'ru',
            english: 'us',
            arabic: 'ar',
            german: 'de',
            french: 'fr'
        };
        return codes[this.currentLanguage] || 'ru';
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
        const total = Math.min(channels.length, 25); // Проверяем не больше 25
        
        for (let i = 0; i < total; i++) {
            const channel = channels[i];
            this.updateProgress(i + 1, total, channel.name);
            
            const isWorking = await this.testStream(channel.url);
            
            if (isWorking) {
                working.push({
                    ...channel,
                    working: true,
                    sourceIndex: i + 1
                });
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
    
    renderResults(channels) {
        this.resultsCount.textContent = `${channels.length} рабочих источников`;
        
        const html = channels.map((channel, index) => `
            <div class="result-card" data-url="${channel.url}" data-name="${this.escapeHtml(channel.name)}">
                <div class="result-header">
                    <div class="result-name">
                        <i class="fas fa-tv"></i> 
                        ${this.escapeHtml(channel.name)}
                        ${channel.playlist ? `<span style="font-size: 11px; color: #888;"> (${this.escapeHtml(channel.playlist)})</span>` : ''}
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
                    <button class="play-btn" onclick="app.playFromPlaylist('${item.id}')" title="Смотреть">
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
    
    playFromPlaylist(id) {
        const channel = this.playlist.find(item => item.id == id);
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
        const channel = this.playlist[index];
        this.playlist.splice(index, 1);
        this.savePlaylist();
        this.renderPlaylist();
        this.showToast(`❌ "${channel.name}" удален из плейлиста`, 'info');
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
                <small style="color: #888; margin-top: 10px; display: block;">
                    Проверяем готовые плейлисты с IPTV каналами
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
    }
    
    updateProgress(current, total, itemName) {
        this.resultsCount.textContent = `Проверка: ${current}/${total}`;
        
        const loadingDiv = this.resultsContainer.querySelector('.loading');
        if (loadingDiv && current <= total) {
            loadingDiv.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                <p>🔍 Проверка доступности потоков...</p>
                <p style="font-size: 14px; margin-top: 10px;">Проверено: ${current}/${total}</p>
                <p style="font-size: 12px; color: #888; max-width: 80%; margin: 10px auto; overflow: hidden; text-overflow: ellipsis;">
                    ${itemName || ''}
                </p>
                <div style="width: 80%; height: 4px; background: #e0e0e0; margin-top: 20px; border-radius: 2px; overflow: hidden;">
                    <div style="width: ${(current/total)*100}%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s;"></div>
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
                <p style="margin-top: 20px;">💡 Попробуйте:</p>
                <ul style="text-align: left; display: inline-block; margin-top: 10px;">
                    <li>• Проверить правильность написания</li>
                    <li>• Использовать короткое название (например "ТНТ" вместо "ТНТ канал")</li>
                    <li>• Попробовать английское название (например "Russia 1")</li>
                    <li>• Сменить язык поиска</li>
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
                <p>${this.escapeHtml(message)}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 8px; cursor: pointer;">
                    Обновить страницу
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
            font-size: 14px;
            white-space: nowrap;
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
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TVChannelFinder();
});
