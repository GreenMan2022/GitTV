// ============== TV CHANNEL FINDER ==============
// Модуль поиска каналов через GitHub API

class TVChannelFinder {
    constructor() {
        this.githubToken = null; // Можно добавить токен
        this.currentLanguage = 'russian';
        this.searchResults = [];
        this.playlist = this.loadPlaylist();
        
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
    }
    
    async searchChannels() {
        const query = this.searchInput.value.trim();
        if (!query) {
            this.showToast('Введите название канала', 'warning');
            return;
        }
        
        this.showLoading();
        
        try {
            // Поиск через GitHub
            const channels = await this.searchGitHub(query);
            
            if (channels.length === 0) {
                this.showNoResults();
                return;
            }
            
            // Проверяем доступность
            this.searchResults = await this.checkAvailability(channels);
            
            // Отображаем результаты
            this.renderResults(this.searchResults);
            
        } catch (error) {
            console.error('Ошибка поиска:', error);
            this.showError('Ошибка при поиске. Попробуйте позже.');
        }
    }
    
    async searchGitHub(channelName) {
        const searchQueries = [
            `${channelName} tv m3u`,
            `${channelName} channel m3u8`,
            `${channelName} iptv`,
            `${channelName} stream`
        ];
        
        let allChannels = [];
        
        for (const query of searchQueries) {
            try {
                const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)} extension:m3u&per_page=30`;
                const response = await fetch(url, {
                    headers: this.githubToken ? { 'Authorization': `token ${this.githubToken}` } : {}
                });
                
                if (response.status === 200) {
                    const data = await response.json();
                    const items = data.items || [];
                    
                    // Парсим каждый файл
                    for (const item of items) {
                        const channels = await this.parseGitHubFile(item);
                        allChannels.push(...channels);
                    }
                }
            } catch (e) {
                console.warn('Ошибка запроса:', e);
            }
        }
        
        // Убираем дубликаты
        const unique = new Map();
        for (const ch of allChannels) {
            if (!unique.has(ch.url)) {
                unique.set(ch.url, ch);
            }
        }
        
        return Array.from(unique.values());
    }
    
    async parseGitHubFile(fileInfo) {
        const channels = [];
        
        try {
            const url = fileInfo.url;
            const response = await fetch(url);
            const content = await response.text();
            
            // Парсим M3U
            const lines = content.split('\n');
            let currentChannel = null;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                if (line.startsWith('#EXTINF:')) {
                    // Извлекаем название
                    const nameMatch = line.match(/,([^,]+)$/);
                    const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
                    
                    // Извлекаем группу
                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    const group = groupMatch ? groupMatch[1] : '';
                    
                    currentChannel = { name, group };
                } else if (line && !line.startsWith('#') && currentChannel) {
                    // URL канала
                    if (!line.includes('github.com') && !line.includes('raw.githubusercontent.com')) {
                        currentChannel.url = line;
                        channels.push({ ...currentChannel });
                    }
                    currentChannel = null;
                }
            }
        } catch (e) {
            console.warn('Ошибка парсинга:', e);
        }
        
        return channels;
    }
    
    async checkAvailability(channels) {
        const checked = [];
        
        for (let i = 0; i < channels.length; i++) {
            const channel = channels[i];
            const isWorking = await this.testStream(channel.url);
            checked.push({
                ...channel,
                working: isWorking,
                source: i + 1
            });
            
            // Обновляем прогресс
            this.updateProgress(i + 1, channels.length);
        }
        
        return checked.filter(ch => ch.working).slice(0, 20); // Только рабочие, макс 20
    }
    
    testStream(url) {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.muted = true;
            let resolved = false;
            
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    resolve(false);
                }
            }, 5000);
            
            if (Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    clearTimeout(timeout);
                    resolved = true;
                    hls.destroy();
                    resolve(true);
                });
                hls.on(Hls.Events.ERROR, () => {
                    clearTimeout(timeout);
                    resolved = true;
                    hls.destroy();
                    resolve(false);
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
                video.addEventListener('loadedmetadata', () => {
                    clearTimeout(timeout);
                    resolved = true;
                    resolve(true);
                });
                video.addEventListener('error', () => {
                    clearTimeout(timeout);
                    resolved = true;
                    resolve(false);
                });
            } else {
                resolve(false);
            }
        });
    }
    
    renderResults(channels) {
        if (channels.length === 0) {
            this.showNoResults();
            return;
        }
        
        this.resultsCount.textContent = `${channels.length} источников`;
        
        const html = channels.map((channel, index) => `
            <div class="result-card" data-url="${channel.url}" data-name="${this.escapeHtml(channel.name)}" data-group="${this.escapeHtml(channel.group || '')}">
                <div class="result-header">
                    <div class="result-name">
                        <i class="fas fa-tv"></i> 
                        Источник ${channel.source} - ${this.escapeHtml(channel.name)}
                    </div>
                    <div class="result-status">
                        <i class="fas fa-check-circle"></i> Доступен
                    </div>
                </div>
                <div class="result-url">
                    ${channel.group ? `<i class="fas fa-folder"></i> ${this.escapeHtml(channel.group)} | ` : ''}
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
        
        // Загружаем новый поток
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
        this.showToast('Канал добавлен в плейлист', 'success');
        
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
        const channel = this.playlist[index];
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
        this.playlist.splice(index, 1);
        this.savePlaylist();
        this.renderPlaylist();
        this.showToast('Канал удален из плейлиста', 'info');
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
                <i class="fas fa-spinner"></i>
                <p>Поиск каналов и проверка доступности...</p>
            </div>
        `;
        this.resultsCount.textContent = 'Поиск...';
    }
    
    updateProgress(current, total) {
        this.resultsCount.textContent = `Проверка: ${current}/${total}`;
    }
    
    showNoResults() {
        this.resultsContainer.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-search"></i>
                <p>Каналы не найдены. Попробуйте другое название</p>
            </div>
        `;
        this.resultsCount.textContent = '0 источников';
    }
    
    showError(message) {
        this.resultsContainer.innerHTML = `
            <div class="placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }
    
    showToast(message, type = 'info') {
        // Создаем временное уведомление
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
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
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

// Запуск приложения
const app = new TVChannelFinder();
