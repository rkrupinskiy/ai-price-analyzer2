/**
 * AI Price Analyzer - ИСПРАВЛЕННАЯ простая версия
 * Работает без дополнительных зависимостей
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
        console.log('🚀 Инициализация AI Price Analyzer');
        this.setupEventListeners();
        this.initVoiceRecognition();
        this.loadData();
        this.renderProducts();
        this.updateUI();
        this.log('info', 'Система AI Price Analyzer запущена успешно');
    }

    loadSettings() {
        const defaultSettings = {
            apiKey: '',
            gptModel: 'gpt-4o',
            competitorPrompt: 'Проанализируй результаты поиска цен и найди минимальную цену товара у конкурентов.',
            avitoPrompt: 'Проанализируй результаты поиска на Avito и найди минимальную б/у цену товара.',
            editPrompt: 'Помоги отредактировать данные товара согласно команде пользователя.'
        };
        
        try {
            const saved = localStorage.getItem('aiAnalyzerSettings');
            const settings = saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
            console.log('✅ Настройки загружены');
            return settings;
        } catch (error) {
            console.error('❌ Ошибка загрузки настроек:', error);
            return defaultSettings;
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('aiAnalyzerSettings', JSON.stringify(this.settings));
            this.log('info', 'Настройки сохранены');
            console.log('💾 Настройки сохранены в localStorage');
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
                console.log(`📦 Загружено ${this.products.length} товаров`);
            }
            
            if (history) {
                this.searchHistory = JSON.parse(history);
                console.log(`📋 Загружено ${this.searchHistory.length} записей истории`);
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            this.log('error', 'Ошибка загрузки данных', error);
        }
    }

    saveData() {
        try {
            localStorage.setItem('aiAnalyzerProducts', JSON.stringify(this.products));
            localStorage.setItem('aiAnalyzerHistory', JSON.stringify(this.searchHistory));
            console.log('💾 Данные сохранены');
        } catch (error) {
            console.error('❌ Ошибка сохранения данных:', error);
            this.log('error', 'Ошибка сохранения данных', error);
        }
    }

    setupEventListeners() {
        console.log('🔗 Настройка обработчиков событий');
        
        // Навигация по вкладкам
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Управление товарами
        const addProductBtn = document.getElementById('addProduct');
        if (addProductBtn) {
            addProductBtn.addEventListener('click', () => this.showProductModal());
        }
        
        const addFirstProductBtn = document.getElementById('addFirstProduct');
        if (addFirstProductBtn) {
            addFirstProductBtn.addEventListener('click', () => this.showProductModal());
        }

        // AI диалог
        const sendMessageBtn = document.getElementById('sendMessage');
        if (sendMessageBtn) {
            sendMessageBtn.addEventListener('click', () => this.sendMessage());
        }
        
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Настройки
        const saveApiBtn = document.getElementById('saveApiSettings');
        if (saveApiBtn) {
            saveApiBtn.addEventListener('click', () => this.saveApiSettings());
        }
        
        const testConnectionBtn = document.getElementById('testConnection');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', () => this.testConnection());
        }

        // Голосовое управление
        const voiceToggleBtn = document.getElementById('voiceToggle');
        if (voiceToggleBtn) {
            voiceToggleBtn.addEventListener('click', () => this.toggleVoice());
        }

        // Форма товара
        const productForm = document.getElementById('productForm');
        if (productForm) {
            productForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProduct();
            });
        }
        
        const cancelProductBtn = document.getElementById('cancelProduct');
        if (cancelProductBtn) {
            cancelProductBtn.addEventListener('click', () => this.hideProductModal());
        }

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

        console.log('✅ Обработчики событий настроены');
    }

    // Вызов OpenAI API
    async callOpenAI(messages, maxTokens = 2000, searchQuery = null, searchType = null) {
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API ключ не настроен. Перейдите в настройки и введите ваш API ключ.');
        }

        if (!this.settings.apiKey.startsWith('sk-')) {
            throw new Error('Неверный формат OpenAI API ключа. Ключ должен начинаться с "sk-"');
        }

        this.showLoading('Обращение к OpenAI API...');
        
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

            console.log('📤 Отправляем запрос к OpenAI API');

            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            console.log(`📥 Получен ответ: ${response.status}`);

            const data = await response.json();

            if (!response.ok) {
                console.error('❌ Ошибка API:', data);
                throw new Error(data.error || `HTTP ${response.status}: ${data.message || 'Unknown error'}`);
            }

            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Некорректный ответ от OpenAI API');
            }

            const content = data.choices[0].message.content;
            
            this.log('info', 'Получен ответ от OpenAI API', {
                tokens: data.usage?.total_tokens || 'unknown',
                model: this.settings.gptModel
            });
            
            console.log('✅ Ответ обработан успешно');
            return content;
            
        } catch (error) {
            console.error('💥 Ошибка OpenAI API:', error);
            throw error;
        } finally {
            this.hideLoading();
        }
    }

    // Поиск цен конкурентов
    async searchCompetitorPrices(command) {
        const productName = this.extractProductName(command);
        if (!productName) {
            this.addMessage('error', 'Не удалось определить название товара из команды');
            return;
        }

        try {
            this.log('info', `Поиск цен конкурентов для: ${productName}`);
            
            const messages = [
                {
                    role: 'system',
                    content: this.settings.competitorPrompt
                },
                {
                    role: 'user',
                    content: `Найди минимальную цену на товар "${productName}" среди конкурентов`
                }
            ];

            const response = await this.callOpenAI(messages, 2000, productName, 'competitor');
            
            // Логируем результат
            this.logSearchResult('competitor', productName, response);
            
            // Извлекаем минимальную цену
            const minPrice = this.extractMinPrice(response);
            
            if (minPrice) {
                this.updateProductPrice(productName, 'competitorNewPrice', minPrice);
                this.addMessage('assistant', `✅ **Найдена минимальная цена у конкурентов: ${minPrice.toLocaleString()} ₽**\n\n${response}`);
                this.showNotification(`Цена конкурентов обновлена для ${productName}`, 'success');
            } else {
                this.addMessage('assistant', `📊 **Результаты поиска цен:**\n\n${response}`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка поиска цен конкурентов:', error);
            this.log('error', 'Ошибка поиска цен конкурентов', error);
            this.addMessage('error', `Ошибка поиска: ${error.message}`);
        }
    }

    // Поиск б/у цен на Avito
    async searchAvitoPrice(command) {
        const productName = this.extractProductName(command);
        if (!productName) {
            this.addMessage('error', 'Не удалось определить название товара из команды');
            return;
        }

        try {
            this.log('info', `Поиск б/у цен на Avito для: ${productName}`);
            
            const messages = [
                {
                    role: 'system',
                    content: this.settings.avitoPrompt
                },
                {
                    role: 'user',
                    content: `Найди минимальную б/у цену на товар "${productName}" на Avito`
                }
            ];

            const response = await this.callOpenAI(messages, 2000, productName, 'avito');
            
            // Логируем результат
            this.logSearchResult('avito', productName, response);
            
            // Извлекаем минимальную цену
            const minPrice = this.extractMinPrice(response);
            
            if (minPrice) {
                this.updateProductPrice(productName, 'competitorUsedPrice', minPrice);
                this.addMessage('assistant', `✅ **Найдена минимальная б/у цена на Avito: ${minPrice.toLocaleString()} ₽**\n\n${response}`);
                this.showNotification(`Б/у цена обновлена для ${productName}`, 'success');
            } else {
                this.addMessage('assistant', `🛒 **Результаты поиска на Avito:**\n\n${response}`);
            }
            
        } catch (error) {
            console.error('❌ Ошибка поиска на Avito:', error);
            this.log('error', 'Ошибка поиска на Avito', error);
            this.addMessage('error', `Ошибка поиска на Avito: ${error.message}`);
        }
    }

    // Отправка сообщения в AI диалог
    async sendMessage() {
        const input = document.getElementById('userInput');
        if (!input) return;
        
        const message = input.value.trim();
        if (!message) return;
        
        this.addMessage('user', message);
        input.value = '';
        
        try {
            await this.processAICommand(message);
        } catch (error) {
            console.error('❌ Ошибка обработки команды:', error);
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
            this.addMessage('assistant', '🔍 **Доступные команды для работы с ценами:**\n\n• **"найди цену на [товар] у конкурентов"** - поиск цен в интернет-магазинах\n• **"найди б/у цену на [товар]"** - поиск на Avito\n• **"измени количество [товар] на [число]"** - редактирование товара\n• **"установи цену продажи [товар] [цена]"** - изменение цены\n\n*Система автоматически найдет цены и обновит таблицу товаров*');
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
            this.addMessage('assistant', response);
            
        } catch (error) {
            console.error('❌ Ошибка редактирования товара:', error);
            this.log('error', 'Ошибка редактирования товара', error);
            this.addMessage('error', `Ошибка редактирования: ${error.message}`);
        }
    }

    // Голосовое управление
    initVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            
            this.speechRecognition.lang = 'ru-RU';
            this.speechRecognition.interimResults = false;
            
            this.speechRecognition.onresult = (event) => {
                const command = event.results[0][0].transcript;
                this.log('info', `Голосовая команда: "${command}"`);
                this.processVoiceCommand(command);
            };
            
            this.speechRecognition.onerror = (event) => {
                console.error('❌ Ошибка распознавания речи:', event.error);
                this.stopVoice();
            };
            
            this.speechRecognition.onend = () => {
                this.stopVoice();
            };
            
            console.log('🎤 Голосовое управление инициализировано');
        } else {
            console.warn('⚠️ Голосовое управление не поддерживается');
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
        }
    }

    processVoiceCommand(command) {
        const lowerCommand = command.toLowerCase();
        
        if (lowerCommand.includes('найди цену') && lowerCommand.includes('конкурент')) {
            this.searchCompetitorPrices(command);
        } else if (lowerCommand.includes('найди') && lowerCommand.includes('б/у')) {
            this.searchAvitoPrice(command);
        } else {
            const userInput = document.getElementById('userInput');
            if (userInput) {
                userInput.value = command;
                this.sendMessage();
            }
        }
    }

    // Управление товарами
    showProductModal(product = null) {
        console.log('📝 Открытие модального окна товара');
        
        const modal = document.getElementById('productModal');
        const title = document.getElementById('modalTitle');
        
        if (!modal || !title) {
            console.error('❌ Модальное окно не найдено');
            return;
        }
        
        if (product) {
            title.textContent = 'Редактировать товар';
            document.getElementById('productName').value = product.name || '';
            document.getElementById('productDescription').value = product.description || '';
            document.getElementById('productQuantity').value = product.quantity || '';
            document.getElementById('productPurchasePrice').value = product.purchasePrice || '';
            document.getElementById('productSalePrice').value = product.salePrice || '';
        } else {
            title.textContent = 'Добавить товар';
            const form = document.getElementById('productForm');
            if (form) form.reset();
        }
        
        modal.classList.add('active');
        modal.dataset.editingId = product ? product.id : '';
        
        // Фокус на первом поле
        const nameInput = document.getElementById('productName');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 100);
        }
    }

    hideProductModal() {
        const modal = document.getElementById('productModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    saveProduct() {
        console.log('💾 Сохранение товара');
        
        const form = document.getElementById('productForm');
        const modal = document.getElementById('productModal');
        
        if (!form || !modal) {
            console.error('❌ Форма или модальное окно не найдены');
            return;
        }
        
        const editingId = modal.dataset.editingId;
        
        const productData = {
            name: form.productName.value.trim(),
            description: form.productDescription.value.trim(),
            quantity: parseInt(form.productQuantity.value) || 0,
            purchasePrice: parseFloat(form.productPurchasePrice.value) || 0,
            salePrice: parseFloat(form.productSalePrice.value) || 0,
            competitorNewPrice: 0,
            competitorUsedPrice: 0,
            lastUpdated: new Date().toLocaleString('ru-RU')
        };
        
        if (!productData.name) {
            this.showNotification('Введите название товара', 'error');
            return;
        }
        
        if (editingId) {
            // Редактирование существующего товара
            const productIndex = this.products.findIndex(p => p.id === editingId);
            if (productIndex !== -1) {
                this.products[productIndex] = { ...this.products[productIndex], ...productData };
                this.log('info', `Товар "${productData.name}" обновлен`);
            }
        } else {
            // Добавление нового товара
            productData.id = Date.now().toString();
            this.products.push(productData);
            this.log('info', `Товар "${productData.name}" добавлен`);
        }
        
        this.saveData();
        this.renderProducts();
        this.updateUI();
        this.hideProductModal();
        
        const action = editingId ? 'обновлен' : 'добавлен';
        this.showNotification(`Товар ${action}`, 'success');
        
        console.log(`✅ Товар "${productData.name}" ${action}`);
    }

    deleteProduct(productId) {
        if (confirm('Удалить этот товар?')) {
            const productIndex = this.products.findIndex(p => p.id === productId);
            if (productIndex !== -1) {
                const productName = this.products[productIndex].name;
                this.products.splice(productIndex, 1);
                this.saveData();
                this.renderProducts();
                this.updateUI();
                this.log('info', `Товар "${productName}" удален`);
                this.showNotification('Товар удален', 'success');
            }
        }
    }

    // Отрисовка товаров
    renderProducts() {
        console.log(`🔄 Отрисовка ${this.products.length} товаров`);
        
        const tbody = document.getElementById('productsTableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (!tbody) {
            console.error('❌ Таблица товаров не найдена');
            return;
        }
        
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
                    <button class="btn btn-sm" onclick="app.showProductModal(app.getProduct('${product.id}'))" title="Редактировать">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteProduct('${product.id}')" title="Удалить">🗑️</button>
                </td>
            </tr>
        `).join('');
        
        console.log('✅ Товары отрисованы');
    }

    // Вспомогательные методы
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
            /цена[:\s]*(\d+(?:\s*\d+)*)/gi
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
        this.log('info', `Результат поиска ${type} для "${productName}" сохранен`);
    }

    // UI методы
    switchTab(tabName) {
        if (!tabName) return;
        
        console.log(`🔀 Переключение на вкладку: ${tabName}`);
        
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
            case 'settings':
                this.renderSettings();
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
        console.log(`📢 Уведомление (${type}): ${message}`);
        
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

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // Настройки
    renderSettings() {
        const apiKeyInput = document.getElementById('apiKey');
        const modelSelect = document.getElementById('gptModel');
        
        if (apiKeyInput) apiKeyInput.value = this.settings.apiKey;
        if (modelSelect) modelSelect.value = this.settings.gptModel;
    }

    saveApiSettings() {
        console.log('💾 Сохранение настроек API');
        
        const apiKeyInput = document.getElementById('apiKey');
        const modelSelect = document.getElementById('gptModel');
        
        if (apiKeyInput) this.settings.apiKey = apiKeyInput.value.trim();
        if (modelSelect) this.settings.gptModel = modelSelect.value;
        
        this.saveSettings();
        this.updateUI();
        this.showNotification('Настройки API сохранены', 'success');
        
        this.log('info', 'Настройки OpenAI API обновлены');
    }

    async testConnection() {
        if (!this.settings.apiKey) {
            this.showNotification('Введите API ключ', 'error');
            return;
        }
        
        try {
            console.log('🧪 Тестирование подключения к OpenAI');
            
            const messages = [
                {
                    role: 'system',
                    content: 'Ответь кратко "Подключение работает" если получил это сообщение.'
                },
                {
                    role: 'user',
                    content: 'Тест подключения к API'
                }
            ];
            
            const response = await this.callOpenAI(messages, 50);
            
            if (response.toLowerCase().includes('работает') || response.toLowerCase().includes('подключение')) {
                this.showNotification('✅ Подключение к OpenAI API успешно', 'success');
                this.updateAPIStatus();
                console.log('✅ Тест подключения пройден');
            } else {
                this.showNotification('⚠️ API отвечает, но ответ неожиданный', 'warning');
                console.log('⚠️ Неожиданный ответ от API:', response);
            }
            
        } catch (error) {
            console.error('❌ Ошибка тестирования подключения:', error);
            this.showNotification(`❌ Ошибка подключения: ${error.message}`, 'error');
            this.log('error', 'Ошибка тестирования API', error);
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
        
        // Логируем в консоль
        const logMessage = `[${level.toUpperCase()}] ${message}`;
        switch (level) {
            case 'error':
                console.error(logMessage, data || '');
                break;
            case 'warning':
                console.warn(logMessage, data || '');
                break;
            default:
                console.log(logMessage, data || '');
        }
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Запуск AI Price Analyzer');
    try {
        app = new AIPriceAnalyzer();
        console.log('✅ AI Price Analyzer запущен успешно');
    } catch (error) {
        console.error('💥 Ошибка запуска приложения:', error);
    }
});