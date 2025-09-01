/**
 * AI Price Analyzer - ОБНОВЛЕННАЯ версия с реальным поиском
 */

class AIPriceAnalyzer {
    constructor() {
        this.products = [];
        this.searchHistory = [];
        this.logs = [];
        this.settings = this.loadSettings();
        this.isVoiceActive = false;
        this.speechRecognition = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initVoiceRecognition();
        this.renderProducts();
        this.updateUI();
        this.loadData();
        this.log('info', 'Система AI Price Analyzer с реальным поиском запущена');
    }

    loadSettings() {
        const defaultSettings = {
            apiKey: '',
            gptModel: 'gpt-4o',
            competitorPrompt: this.getDefaultCompetitorPrompt(),
            avitoPrompt: this.getDefaultAvitoPrompt(),
            editPrompt: this.getDefaultEditPrompt(),
            customColumns: []
        };
        
        try {
            const saved = localStorage.getItem('aiAnalyzerSettings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (error) {
            this.log('error', 'Ошибка загрузки настроек', error);
            return defaultSettings;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('aiAnalyzerSettings', JSON.stringify(this.settings));
            this.log('info', 'Настройки сохранены');
        } catch (error) {
            this.log('error', 'Ошибка сохранения настроек', error);
        }
    }

    loadData() {
        try {
            const products = localStorage.getItem('aiAnalyzerProducts');
            const history = localStorage.getItem('aiAnalyzerHistory');
            
            if (products) {
                this.products = JSON.parse(products);
                this.renderProducts();
                this.updateProductCount();
            }
            
            if (history) {
                this.searchHistory = JSON.parse(history);
                this.renderHistory();
            }
        } catch (error) {
            this.log('error', 'Ошибка загрузки данных', error);
        }
    }

    saveData() {
        try {
            localStorage.setItem('aiAnalyzerProducts', JSON.stringify(this.products));
            localStorage.setItem('aiAnalyzerHistory', JSON.stringify(this.searchHistory));
        } catch (error) {
            this.log('error', 'Ошибка сохранения данных', error);
        }
    }

    setupEventListeners() {
        // Навигация по вкладкам
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Управление файлами
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.importFile(e.target.files[0]);
        });
        
        document.getElementById('exportExcel').addEventListener('click', () => this.exportToExcel());
        document.getElementById('exportCsv').addEventListener('click', () => this.exportToCsv());

        // Управление товарами
        document.getElementById('addProduct').addEventListener('click', () => this.showProductModal());
        document.getElementById('addFirstProduct')?.addEventListener('click', () => this.showProductModal());
        
        document.getElementById('searchProducts').addEventListener('input', (e) => {
            this.filterProducts(e.target.value);
        });
        
        document.getElementById('selectAll').addEventListener('click', () => this.selectAllProducts());
        document.getElementById('bulkCompetitorSearch').addEventListener('click', () => this.bulkSearchCompetitors());
        document.getElementById('bulkAvitoSearch').addEventListener('click', () => this.bulkSearchAvito());

        // AI диалог
        document.getElementById('sendMessage').addEventListener('click', () => this.sendMessage());
        document.getElementById('userInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        document.getElementById('voiceToggle').addEventListener('click', () => this.toggleVoice());
        document.getElementById('voiceInput').addEventListener('click', () => this.startVoiceInput());

        // Настройки
        document.getElementById('saveApiSettings').addEventListener('click', () => this.saveApiSettings());
        document.getElementById('testConnection').addEventListener('click', () => this.testConnection());
        document.getElementById('savePrompts').addEventListener('click', () => this.savePrompts());
        document.getElementById('resetPrompts').addEventListener('click', () => this.resetPrompts());
        document.getElementById('addColumn')?.addEventListener('click', () => this.showColumnModal());

        // Модальные окна
        document.getElementById('productForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
        
        document.getElementById('cancelProduct')?.addEventListener('click', () => this.hideProductModal());

        // История и логи
        document.getElementById('clearHistory')?.addEventListener('click', () => this.clearHistory());
        document.getElementById('exportHistory')?.addEventListener('click', () => this.exportHistory());
        document.getElementById('clearLogs')?.addEventListener('click', () => this.clearLogs());
        document.getElementById('exportLogs')?.addEventListener('click', () => this.exportLogs());
        
        document.getElementById('historyFilter')?.addEventListener('change', () => this.renderHistory());
        document.getElementById('logLevel')?.addEventListener('change', () => this.renderLogs());

        // Глобальные события
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.hideAllModals();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideAllModals();
            }
        });
    }

    // ОБНОВЛЕННЫЙ МЕТОД: вызов OpenAI с поиском
    async callOpenAI(messages, maxTokens = 3000, searchQuery = null, searchType = null) {
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API ключ не настроен');
        }

        this.showLoading('Выполняем поиск и анализ цен...');
        
        try {
            const requestBody = {
                apiKey: this.settings.apiKey,
                messages: messages,
                model: this.settings.gptModel,
                temperature: 0.1,
                maxTokens: maxTokens
            };

            // Добавляем параметры поиска если они есть
            if (searchQuery && searchType) {
                requestBody.searchQuery = searchQuery;
                requestBody.searchType = searchType;
                this.log('info', `Запрос с поиском: "${searchQuery}" (тип: ${searchType})`);
            }

            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            
            this.log('info', 'Получен ответ от OpenAI API с результатами поиска', {
                tokens: data.usage?.total_tokens || 'unknown',
                model: this.settings.gptModel,
                hasSearch: !!(searchQuery && searchType)
            });
            
            return content;
        } finally {
            this.hideLoading();
        }
    }

    // ОБНОВЛЕННЫЙ МЕТОД: поиск цен конкурентов с реальным поиском
    async searchCompetitorPrices(command) {
        const productName = this.extractProductName(command);
        if (!productName) {
            this.addMessage('error', 'Не удалось определить название товара из команды');
            return;
        }

        try {
            this.log('info', `Начинаем поиск цен конкурентов для: ${productName}`);
            
            const messages = [
                {
                    role: 'system',
                    content: `Ты аналитик цен. Проанализируй РЕАЛЬНЫЕ результаты поиска и найди минимальную цену товара "${productName}" у российских конкурентов.

ЗАДАЧА:
1. Проанализируй предоставленные результаты поиска
2. Найди минимальную цену среди всех предложений
3. Укажи источник с минимальной ценой

ФОРМАТ ОТВЕТА:
Минимальная цена: [ЦЕНА] ₽
Источник: [МАГАЗИН]
Ссылка: [URL]
Статус: [В наличии/Под заказ]

АНАЛИЗ:
[Краткий анализ всех найденных предложений]

ВАЖНО: Используй ТОЛЬКО данные из результатов поиска.`
                },
                {
                    role: 'user',
                    content: `Найди минимальную цену на товар "${productName}" среди результатов поиска`
                }
            ];

            // Выполняем запрос с реальным поиском
            const response = await this.callOpenAI(messages, 3000, productName, 'competitor');
            
            // Логируем полный ответ
            this.logSearchResult('competitor', productName, response);
            
            // Пытаемся извлечь минимальную цену
            const minPrice = this.extractMinPrice(response);
            
            if (minPrice) {
                this.updateProductPrice(productName, 'competitorNewPrice', minPrice);
                this.addMessage('assistant', `✅ **Найдена минимальная цена у конкурентов: ${minPrice.toLocaleString()} ₽**\n\n${response}`);
                this.showNotification(`Цена конкурентов обновлена: ${productName}`, 'success');
            } else {
                this.addMessage('assistant', `📊 Результаты поиска цен:\n\n${response}`);
            }
            
        } catch (error) {
            this.log('error', 'Ошибка поиска цен конкурентов', error);
            this.addMessage('error', `Ошибка поиска: ${error.message}`);
        }
    }

    // ОБНОВЛЕННЫЙ МЕТОД: поиск б/у цен на Avito
    async searchAvitoPrice(command) {
        const productName = this.extractProductName(command);
        if (!productName) {
            this.addMessage('error', 'Не удалось определить название товара из команды');
            return;
        }

        try {
            this.log('info', `Начинаем поиск б/у цен на Avito для: ${productName}`);
            
            const messages = [
                {
                    role: 'system',
                    content: `Ты аналитик б/у рынка на Avito. Проанализируй РЕАЛЬНЫЕ результаты поиска с Avito.ru и найди минимальную цену товара "${productName}".

ЗАДАЧА:
1. Проанализируй предоставленные результаты с Avito
2. Найди минимальную б/у цену
3. Учти состояние товара при анализе

ФОРМАТ ОТВЕТА:
Минимальная б/у цена: [ЦЕНА] ₽
Состояние: [ОПИСАНИЕ]
Местоположение: [ГОРОД]
Продавец: [ТИП ПРОДАВЦА]
Ссылка: [URL]

АНАЛИЗ:
[Краткий анализ рынка б/у товаров]

ВАЖНО: Используй ТОЛЬКО данные из результатов поиска Avito.`
                },
                {
                    role: 'user',
                    content: `Найди минимальную б/у цену на товар "${productName}" среди результатов поиска на Avito`
                }
            ];

            // Выполняем запрос с реальным поиском на Avito
            const response = await this.callOpenAI(messages, 3000, productName, 'avito');
            
            // Логируем полный ответ
            this.logSearchResult('avito', productName, response);
            
            // Пытаемся извлечь минимальную цену
            const minPrice = this.extractMinPrice(response);
            
            if (minPrice) {
                this.updateProductPrice(productName, 'competitorUsedPrice', minPrice);
                this.addMessage('assistant', `✅ **Найдена минимальная б/у цена на Avito: ${minPrice.toLocaleString()} ₽**\n\n${response}`);
                this.showNotification(`Б/у цена обновлена: ${productName}`, 'success');
            } else {
                this.addMessage('assistant', `🛒 Результаты поиска на Avito:\n\n${response}`);
            }
            
        } catch (error) {
            this.log('error', 'Ошибка поиска на Avito', error);
            this.addMessage('error', `Ошибка поиска на Avito: ${error.message}`);
        }
    }

    // Голосовое управление
    initVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            
            this.speechRecognition.lang = 'ru-RU';
            this.speechRecognition.interimResults = false;
            this.speechRecognition.maxAlternatives = 1;
            
            this.speechRecognition.onresult = (event) => {
                const command = event.results[0][0].transcript;
                this.log('info', `Голосовая команда: "${command}"`);
                this.processVoiceCommand(command);
            };
            
            this.speechRecognition.onerror = (event) => {
                this.log('error', 'Ошибка распознавания речи', event.error);
                this.stopVoice();
            };
            
            this.speechRecognition.onend = () => {
                this.stopVoice();
            };
        } else {
            this.log('warning', 'Голосовое управление не поддерживается в этом браузере');
        }
    }

    toggleVoice() {
        if (this.isVoiceActive) {
            this.stopVoice();
        } else {
            this.startVoice();
        }
    }

    startVoice() {
        if (!this.speechRecognition) {
            this.showNotification('Голосовое управление не поддерживается', 'error');
            return;
        }
        
        this.isVoiceActive = true;
        this.speechRecognition.start();
        
        const voiceBtn = document.getElementById('voiceToggle');
        if (voiceBtn) {
            voiceBtn.classList.add('active');
            voiceBtn.textContent = '🔴 Запись';
        }
        
        const voiceStatus = document.getElementById('voiceStatus');
        if (voiceStatus) {
            voiceStatus.textContent = 'Слушаю команды...';
        }
        
        this.log('info', 'Голосовое управление активировано');
    }

    stopVoice() {
        if (this.speechRecognition && this.isVoiceActive) {
            this.isVoiceActive = false;
            this.speechRecognition.stop();
            
            const voiceBtn = document.getElementById('voiceToggle');
            if (voiceBtn) {
                voiceBtn.classList.remove('active');
                voiceBtn.textContent = '🎤 Голос';
            }
            
            const voiceStatus = document.getElementById('voiceStatus');
            if (voiceStatus) {
                voiceStatus.textContent = 'Голосовые команды отключены';
            }
        }
    }

    startVoiceInput() {
        if (!this.speechRecognition) {
            this.showNotification('Голосовое управление не поддерживается', 'error');
            return;
        }
        
        const btn = document.getElementById('voiceInput');
        if (btn) {
            btn.classList.add('active');
            btn.textContent = '🔴';
        }
        
        this.speechRecognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = text;
            }
            
            if (btn) {
                btn.classList.remove('active');
                btn.textContent = '🎤';
            }
        };
        
        this.speechRecognition.start();
    }

    processVoiceCommand(command) {
        const lowerCommand = command.toLowerCase();
        
        // Команды поиска цен
        if (lowerCommand.includes('найди цену') && lowerCommand.includes('конкурент')) {
            this.searchCompetitorPrices(command);
        } else if (lowerCommand.includes('найди') && lowerCommand.includes('б/у')) {
            this.searchAvitoPrice(command);
        } else if (lowerCommand.includes('измени')) {
            this.editProductData(command);
        } else {
            // Отправляем в AI диалог
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = command;
                this.sendMessage();
            }
        }
    }

    // Отправка сообщения в AI диалог
    async sendMessage() {
        const input = document.getElementById('userInput');
        if (!input) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        // Добавляем сообщение пользователя
        this.addMessage('user', message);
        input.value = '';
        
        try {
            // Определяем тип команды и обрабатываем
            await this.processAICommand(message);
        } catch (error) {
            this.log('error', 'Ошибка обработки команды AI', error);
            this.addMessage('error', `Ошибка: ${error.message}`);
        }
    }

    async processAICommand(command) {
        const lowerCommand = command.toLowerCase();
        
        if (lowerCommand.includes('найди цену') && lowerCommand.includes('конкурент')) {
            await this.searchCompetitorPrices(command);
        } else if (lowerCommand.includes('найди') && lowerCommand.includes('б/у')) {
            await this.searchAvitoPrice(command);
        } else if (lowerCommand.includes('измени') || lowerCommand.includes('установи') || lowerCommand.includes('обнови')) {
            await this.editProductData(command);
        } else {
            this.addMessage('assistant', '🔍 **Доступные команды для поиска цен:**\n\n• "найди цену на [товар] у конкурентов" - поиск по всем магазинам\n• "найди б/у цену на [товар]" - поиск на Avito\n• "измени количество [товар] на [число]" - редактирование товара\n• "установи цену продажи [товар] [цена]" - изменение цены\n\n*Система выполняет РЕАЛЬНЫЙ поиск в интернете и на Avito*');
        }
    }

    // Редактирование данных товара
    async editProductData(command) {
        try {
            const messages = [
                {
                    role: 'system',
                    content: this.settings.editPrompt
                },
                {
                    role: 'user',
                    content: `Команда: "${command}"\nСписок товаров: ${JSON.stringify(this.products.map(p => ({name: p.name, quantity: p.quantity, purchasePrice: p.purchasePrice, salePrice: p.salePrice})))}`
                }
            ];

            const response = await this.callOpenAI(messages);
            
            // Пытаемся извлечь инструкции по редактированию
            const editInstructions = this.parseEditInstructions(response);
            
            if (editInstructions.success) {
                this.applyEdit(editInstructions);
                this.addMessage('assistant', `✅ Данные товара обновлены: ${editInstructions.description}`);
                this.showNotification('Товар обновлен', 'success');
            } else {
                this.addMessage('assistant', response);
            }
            
        } catch (error) {
            this.log('error', 'Ошибка редактирования товара', error);
            this.addMessage('error', `Ошибка редактирования: ${error.message}`);
        }
    }

    // Вспомогательные методы
    extractProductName(command) {
        const patterns = [
            /найди.*?(?:цену|б\/у).*?на\s+(.+?)(?:\s+у|\s*$)/i,
            /измени.*?количество\s+(.+?)\s+на/i,
            /установи.*?цену.*?\s+(.+?)\s+\d+/i
        ];
        
        for (const pattern of patterns) {
            const match = command.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }
        
        return null;
    }

    extractMinPrice(response) {
        const pricePatterns = [
            /минимальная\s+(?:цена|б\/у\s+цена)[:\s]*(\d+(?:\s*\d+)*)/gi,
            /(\d+(?:\s*\d+)*)\s*₽/gi,
            /цена[:\s]*(\d+(?:\s*\d+)*)/gi,
            /стоимость[:\s]*(\d+(?:\s*\d+)*)/gi
        ];
        
        const prices = [];
        
        for (const pattern of pricePatterns) {
            let match;
            while ((match = pattern.exec(response)) !== null) {
                const priceStr = match[1].replace(/\s+/g, '');
                const price = parseInt(priceStr);
                if (price > 100 && price < 10000000) {
                    prices.push(price);
                }
            }
        }
        
        return prices.length > 0 ? Math.min(...prices) : null;
    }

    parseEditInstructions(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            // JSON не найден, пробуем текстовый анализ
        }
        
        return {
            success: false,
            description: response
        };
    }

    // Обновление данных
    updateProductPrice(productName, priceField, price) {
        const product = this.products.find(p => 
            p.name.toLowerCase().includes(productName.toLowerCase()) ||
            productName.toLowerCase().includes(p.name.toLowerCase())
        );
        
        if (product) {
            product[priceField] = price;
            product.lastUpdated = new Date().toLocaleString('ru-RU');
            this.saveData();
            this.renderProducts();
            this.log('info', `Обновлена ${priceField} для товара ${product.name}: ${price}`);
        }
    }

    applyEdit(instructions) {
        if (instructions.productName && instructions.field && instructions.value) {
            const product = this.products.find(p => 
                p.name.toLowerCase().includes(instructions.productName.toLowerCase())
            );
            
            if (product) {
                product[instructions.field] = instructions.value;
                product.lastUpdated = new Date().toLocaleString('ru-RU');
                this.saveData();
                this.renderProducts();
            }
        }
    }

    // Логирование поиска
    logSearchResult(type, productName, result) {
        const searchResult = {
            id: Date.now(),
            timestamp: new Date().toLocaleString('ru-RU'),
            type: type,
            productName: productName,
            result: result,
            minPrice: this.extractMinPrice(result)
        };
        
        this.searchHistory.unshift(searchResult);
        if (this.searchHistory.length > 100) {
            this.searchHistory = this.searchHistory.slice(0, 100);
        }
        
        this.saveData();
        this.renderHistory();
        
        this.log('info', `Результат поиска ${type} для "${productName}" сохранен`);
    }

    // Остальные методы (управление товарами, импорт/экспорт, UI) остаются прежними
    // ... (здесь будут все остальные методы из предыдущей версии)

    // UI утилиты
    addMessage(type, content) {
        const messagesContainer = document.getElementById('dialogMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        const notifications = document.getElementById('notifications');
        if (notifications) {
            notifications.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    }

    showLoading(message = 'Загрузка...') {
        const loading = document.getElementById('loadingIndicator');
        const loadingText = document.querySelector('.loading-text');
        
        if (loading && loadingText) {
            loadingText.textContent = message;
            loading.classList.add('active');
        }
    }

    hideLoading() {
        const loading = document.getElementById('loadingIndicator');
        if (loading) {
            loading.classList.remove('active');
        }
    }

    log(level, message, data = null) {
        const logEntry = {
            timestamp: new Date().toLocaleString('ru-RU'),
            level: level,
            message: message,
            data: data
        };
        
        this.logs.unshift(logEntry);
        
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(0, 1000);
        }
        
        console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    }

    // Промпты по умолчанию
    getDefaultCompetitorPrompt() {
        return `Ты аналитик цен с доступом к РЕАЛЬНЫМ результатам поиска. Проанализируй предоставленные данные поиска цен и найди минимальную цену товара у российских конкурентов.`;
    }

    getDefaultAvitoPrompt() {
        return `Ты аналитик б/у рынка. Проанализируй РЕАЛЬНЫЕ результаты поиска с Avito.ru и найди минимальную цену б/у товара.`;
    }

    getDefaultEditPrompt() {
        return `Ты помощник по редактированию товаров. Проанализируй команду и верни инструкции по изменению данных товара.`;
    }

    // Методы управления товарами (добавить все остальные методы из предыдущей версии)
    renderProducts() {
        const tbody = document.getElementById('productsTableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (!tbody) return;
        
        if (this.products.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        if (emptyState) emptyState.style.display = 'none';
        
        tbody.innerHTML = this.products.map(product => `
            <tr data-product-id="${product.id}">
                <td><input type="checkbox" class="product-checkbox" value="${product.id}"></td>
                <td><input type="text" value="${product.name || ''}" onchange="app.updateProduct('${product.id}', 'name', this.value)"></td>
                <td><textarea onchange="app.updateProduct('${product.id}', 'description', this.value)">${product.description || ''}</textarea></td>
                <td><input type="number" value="${product.quantity || 0}" onchange="app.updateProduct('${product.id}', 'quantity', parseInt(this.value))"></td>
                <td><input type="number" step="0.01" value="${product.purchasePrice || 0}" onchange="app.updateProduct('${product.id}', 'purchasePrice', parseFloat(this.value))"></td>
                <td><input type="number" step="0.01" value="${product.salePrice || 0}" onchange="app.updateProduct('${product.id}', 'salePrice', parseFloat(this.value))"></td>
                <td class="price-cell ${(product.competitorNewPrice || 0) > 0 ? 'has-price' : ''}">${(product.competitorNewPrice || 0) > 0 ? (product.competitorNewPrice).toLocaleString() + ' ₽' : '—'}</td>
                <td class="price-cell ${(product.competitorUsedPrice || 0) > 0 ? 'has-price' : ''}">${(product.competitorUsedPrice || 0) > 0 ? (product.competitorUsedPrice).toLocaleString() + ' ₽' : '—'}</td>
                <td class="last-updated">${product.lastUpdated || '—'}</td>
                <td class="cell-actions">
                    <button class="btn btn-sm" onclick="app.searchSingleCompetitor('${product.id}')" title="Найти цены конкурентов">🔍</button>
                    <button class="btn btn-sm" onclick="app.searchSingleAvito('${product.id}')" title="Найти на Avito">🛒</button>
                    <button class="btn btn-sm" onclick="app.deleteProduct('${product.id}')" title="Удалить">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    updateProduct(productId, field, value) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            product[field] = value;
            product.lastUpdated = new Date().toLocaleString('ru-RU');
            this.saveData();
            this.log('info', `Обновлено поле ${field} товара ${product.name}`);
        }
    }

    getProduct(productId) {
        return this.products.find(p => p.id === productId);
    }

    async searchSingleCompetitor(productId) {
        const product = this.getProduct(productId);
        if (product) {
            await this.searchCompetitorPrices(`найди цену на ${product.name} у конкурентов`);
        }
    }

    async searchSingleAvito(productId) {
        const product = this.getProduct(productId);
        if (product) {
            await this.searchAvitoPrice(`найди б/у цену на ${product.name}`);
        }
    }

    deleteProduct(productId) {
        if (confirm('Удалить этот товар?')) {
            const productIndex = this.products.findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                const productName = this.products[productIndex].name;
                this.products.splice(productIndex, 1);
                this.saveData();
                this.renderProducts();
                this.updateProductCount();
                this.log('info', `Товар "${productName}" удален`);
                this.showNotification('Товар удален', 'success');
            }
        }
    }

    // Метод переключения вкладок
    switchTab(tabName) {
        // Удаляем активные классы
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Добавляем активные классы
        const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
        const targetContent = document.getElementById(tabName);
        
        if (targetTab) targetTab.classList.add('active');
        if (targetContent) targetContent.classList.add('active');
        
        // Обновляем содержимое вкладки
        this.updateTabContent(tabName);
    }

    updateTabContent(tabName) {
        switch (tabName) {
            case 'history':
                this.renderHistory();
                break;
            case 'settings':
                this.renderSettings();
                break;
            case 'logs':
                this.renderLogs();
                break;
        }
    }

    updateUI() {
        this.updateAPIStatus();
        this.updateProductCount();
    }

    updateAPIStatus() {
        const statusElement = document.getElementById('apiStatus');
        
        if (!statusElement) return;
        
        if (this.settings.apiKey && this.settings.apiKey.startsWith('sk-')) {
            statusElement.textContent = 'API настроен';
            statusElement.className = 'status success';
        } else {
            statusElement.textContent = 'API не настроен';
            statusElement.className = 'status error';
        }
    }

    updateProductCount() {
        const countElement = document.getElementById('productCount');
        if (countElement) {
            countElement.textContent = `Товаров: ${this.products.length}`;
        }
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Обработчики настроек
    saveApiSettings() {
        const apiKeyInput = document.getElementById('apiKey');
        const modelSelect = document.getElementById('gptModel');
        
        if (apiKeyInput) this.settings.apiKey = apiKeyInput.value.trim();
        if (modelSelect) this.settings.gptModel = modelSelect.value;
        
        this.saveSettings();
        this.updateAPIStatus();
        this.showNotification('Настройки API сохранены', 'success');
        
        this.log('info', 'Настройки OpenAI API обновлены');
    }

    async testConnection() {
        if (!this.settings.apiKey) {
            this.showNotification('Введите API ключ', 'error');
            return;
        }
        
        try {
            const messages = [
                {
                    role: 'system',
                    content: 'Ответь кратко "API работает корректно" если получил это сообщение.'
                },
                {
                    role: 'user',
                    content: 'Тест подключения'
                }
            ];
            
            const response = await this.callOpenAI(messages, 100);
            
            if (response.toLowerCase().includes('работает')) {
                this.showNotification('✅ Подключение к API успешно', 'success');
                this.updateAPIStatus();
            } else {
                this.showNotification('⚠️ API отвечает, но странно', 'warning');
            }
            
        } catch (error) {
            this.showNotification(`❌ Ошибка подключения: ${error.message}`, 'error');
            this.log('error', 'Ошибка тестирования API', error);
        }
    }

    renderHistory() {
        // Методы рендеринга истории, логов и других компонентов
        // (добавить при необходимости)
    }

    renderSettings() {
        const apiKeyInput = document.getElementById('apiKey');
        const modelSelect = document.getElementById('gptModel');
        
        if (apiKeyInput) apiKeyInput.value = this.settings.apiKey;
        if (modelSelect) modelSelect.value = this.settings.gptModel;
    }

    renderLogs() {
        // Рендер логов
    }

    // Импорт/экспорт (добавить методы при необходимости)
    importFile(file) {
        // Метод импорта файлов
    }

    exportToExcel() {
        // Метод экспорта в Excel
    }

    exportToCsv() {
        // Метод экспорта в CSV
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AIPriceAnalyzer();
    console.log('🚀 AI Price Analyzer с реальным поиском запущен');
});