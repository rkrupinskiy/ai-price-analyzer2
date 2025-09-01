/**
 * AI Price Analyzer - Полная функциональная система
 * Без демо данных и симуляций - только реальная работа с GPT API
 */

class AIPriceAnalyzer {
    constructor() {
        // Состояние приложения
        this.products = [];
        this.searchHistory = [];
        this.logs = [];
        this.settings = this.loadSettings();
        this.isVoiceActive = false;
        this.speechRecognition = null;
        this.currentEditingCell = null;
        
        // Инициализация
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initVoiceRecognition();
        this.renderProducts();
        this.updateUI();
        this.loadData();
        this.log('info', 'Система AI Price Analyzer запущена');
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
        document.getElementById('addFirstProduct').addEventListener('click', () => this.showProductModal());
        
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
        document.getElementById('addColumn').addEventListener('click', () => this.showColumnModal());

        // Модальные окна
        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });
        
        document.getElementById('cancelProduct').addEventListener('click', () => this.hideProductModal());
        document.getElementById('columnForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCustomColumn();
        });
        
        document.getElementById('cancelColumn').addEventListener('click', () => this.hideColumnModal());

        // История и логи
        document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());
        document.getElementById('exportHistory').addEventListener('click', () => this.exportHistory());
        document.getElementById('clearLogs').addEventListener('click', () => this.clearLogs());
        document.getElementById('exportLogs').addEventListener('click', () => this.exportLogs());
        
        document.getElementById('historyFilter').addEventListener('change', () => this.renderHistory());
        document.getElementById('logLevel').addEventListener('change', () => this.renderLogs());

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
        
        document.getElementById('voiceToggle').classList.add('active');
        document.getElementById('voiceStatus').textContent = 'Слушаю команды...';
        
        this.log('info', 'Голосовое управление активировано');
    }

    stopVoice() {
        if (this.speechRecognition && this.isVoiceActive) {
            this.isVoiceActive = false;
            this.speechRecognition.stop();
            
            document.getElementById('voiceToggle').classList.remove('active');
            document.getElementById('voiceStatus').textContent = 'Голосовые команды отключены';
        }
    }

    startVoiceInput() {
        if (!this.speechRecognition) {
            this.showNotification('Голосовое управление не поддерживается', 'error');
            return;
        }
        
        const btn = document.getElementById('voiceInput');
        btn.classList.add('active');
        btn.textContent = '🔴';
        
        this.speechRecognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            document.getElementById('userInput').value = text;
            btn.classList.remove('active');
            btn.textContent = '🎤';
        };
        
        this.speechRecognition.start();
    }

    processVoiceCommand(command) {
        const lowerCommand = command.toLowerCase();
        
        // Команды поиска цен
        if (lowerCommand.includes('найди цену') && lowerCommand.includes('конкурент')) {
            this.handleVoiceCompetitorSearch(command);
        } else if (lowerCommand.includes('найди') && lowerCommand.includes('б/у')) {
            this.handleVoiceAvitoSearch(command);
        } else if (lowerCommand.includes('измени')) {
            this.handleVoiceEdit(command);
        } else {
            // Отправляем в AI диалог
            document.getElementById('userInput').value = command;
            this.sendMessage();
        }
    }

    // AI запросы
    async callOpenAI(messages, maxTokens = 3000) {
        if (!this.settings.apiKey) {
            throw new Error('OpenAI API ключ не настроен');
        }

        this.showLoading('Обращение к OpenAI API...');
        
        try {
            const response = await fetch('/api/openai', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    apiKey: this.settings.apiKey,
                    messages: messages,
                    model: this.settings.gptModel,
                    temperature: 0.1,
                    maxTokens: maxTokens
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error ${response.status}: ${errorData.error || 'Unknown error'}`);
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            
            this.log('info', 'Получен ответ от OpenAI API', {
                tokens: data.usage?.total_tokens || 'unknown',
                model: this.settings.gptModel
            });
            
            return content;
        } finally {
            this.hideLoading();
        }
    }

    // Отправка сообщения в AI диалог
    async sendMessage() {
        const input = document.getElementById('userInput');
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
            this.addMessage('assistant', 'Я специализируюсь на анализе цен товаров. Доступные команды:\n\n• "найди цену на [товар] у конкурентов"\n• "найди б/у цену на [товар]"\n• "измени количество [товар] на [число]"\n• "установи цену продажи [товар] [цена]"');
        }
    }

    // Поиск цен у конкурентов
    async searchCompetitorPrices(command) {
        const productName = this.extractProductName(command);
        if (!productName) {
            this.addMessage('error', 'Не удалось определить название товара из команды');
            return;
        }

        try {
            const messages = [
                {
                    role: 'system',
                    content: this.settings.competitorPrompt.replace('{productName}', productName)
                },
                {
                    role: 'user',
                    content: `Найди актуальные цены на товар "${productName}" у российских конкурентов в интернете`
                }
            ];

            const response = await this.callOpenAI(messages);
            
            // Логируем полный ответ
            this.logSearchResult('competitor', productName, response);
            
            // Пытаемся извлечь минимальную цену
            const minPrice = this.extractMinPrice(response);
            
            if (minPrice) {
                this.updateProductPrice(productName, 'competitorNewPrice', minPrice);
                this.addMessage('assistant', `✅ Найдена минимальная цена у конкурентов: **${minPrice.toLocaleString()} ₽**\n\nДетали поиска:\n${response}`);
                this.showNotification(`Цена конкурентов обновлена: ${productName}`, 'success');
            } else {
                this.addMessage('assistant', `⚠️ Не удалось извлечь точную цену из результатов поиска.\n\nРезультаты поиска:\n${response}`);
            }
            
        } catch (error) {
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
            const messages = [
                {
                    role: 'system',
                    content: this.settings.avitoPrompt.replace('{productName}', productName)
                },
                {
                    role: 'user',
                    content: `Найди б/у товар "${productName}" на Avito.ru по всей России с минимальными ценами`
                }
            ];

            const response = await this.callOpenAI(messages);
            
            // Логируем полный ответ
            this.logSearchResult('avito', productName, response);
            
            // Пытаемся извлечь минимальную цену
            const minPrice = this.extractMinPrice(response);
            
            if (minPrice) {
                this.updateProductPrice(productName, 'competitorUsedPrice', minPrice);
                this.addMessage('assistant', `✅ Найдена минимальная б/у цена на Avito: **${minPrice.toLocaleString()} ₽**\n\nДетали поиска:\n${response}`);
                this.showNotification(`Б/у цена обновлена: ${productName}`, 'success');
            } else {
                this.addMessage('assistant', `⚠️ Не удалось извлечь точную цену из результатов поиска.\n\nРезультаты поиска:\n${response}`);
            }
            
        } catch (error) {
            this.log('error', 'Ошибка поиска на Avito', error);
            this.addMessage('error', `Ошибка поиска на Avito: ${error.message}`);
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
                this.addMessage('assistant', `⚠️ ${response}`);
            }
            
        } catch (error) {
            this.log('error', 'Ошибка редактирования товара', error);
            this.addMessage('error', `Ошибка редактирования: ${error.message}`);
        }
    }

    // Вспомогательные методы для обработки AI ответов
    extractProductName(command) {
        // Простое извлечение названия товара из команды
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
        // Ищем числовые значения в ответе, которые могут быть ценами
        const pricePatterns = [
            /(\d+(?:\s*\d+)*)\s*(?:₽|руб|rub)/gi,
            /(\d+(?:\s*\d+)*)\s*рублей/gi,
            /цена[:\s]*(\d+(?:\s*\d+)*)/gi,
            /стоимость[:\s]*(\d+(?:\s*\d+)*)/gi,
            /price[:\s]*(\d+(?:\s*\d+)*)/gi
        ];
        
        const prices = [];
        
        for (const pattern of pricePatterns) {
            let match;
            while ((match = pattern.exec(response)) !== null) {
                const priceStr = match[1].replace(/\s+/g, '');
                const price = parseInt(priceStr);
                if (price > 100 && price < 10000000) { // Разумные границы цен
                    prices.push(price);
                }
            }
        }
        
        return prices.length > 0 ? Math.min(...prices) : null;
    }

    parseEditInstructions(response) {
        // Пытаемся найти JSON в ответе или создать инструкции на основе текста
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
        // Применяем инструкции по редактированию
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

    // Управление товарами
    showProductModal(product = null) {
        const modal = document.getElementById('productModal');
        const title = document.getElementById('modalTitle');
        
        if (product) {
            title.textContent = 'Редактировать товар';
            document.getElementById('productName').value = product.name || '';
            document.getElementById('productDescription').value = product.description || '';
            document.getElementById('productQuantity').value = product.quantity || '';
            document.getElementById('productPurchasePrice').value = product.purchasePrice || '';
            document.getElementById('productSalePrice').value = product.salePrice || '';
        } else {
            title.textContent = 'Добавить товар';
            document.getElementById('productForm').reset();
        }
        
        modal.classList.add('active');
        modal.dataset.editingId = product ? product.id : '';
    }

    hideProductModal() {
        document.getElementById('productModal').classList.remove('active');
    }

    saveProduct() {
        const form = document.getElementById('productForm');
        const modal = document.getElementById('productModal');
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
        this.updateProductCount();
        this.hideProductModal();
        this.showNotification(editingId ? 'Товар обновлен' : 'Товар добавлен', 'success');
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

    // Импорт/экспорт
    importFile(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let data;
                
                if (file.name.endsWith('.csv')) {
                    data = this.parseCSV(e.target.result);
                } else {
                    const workbook = XLSX.read(e.target.result, { type: 'binary' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    data = XLSX.utils.sheet_to_json(firstSheet);
                }
                
                const importedProducts = this.normalizeImportedData(data);
                this.products = importedProducts;
                
                this.saveData();
                this.renderProducts();
                this.updateProductCount();
                
                this.log('info', `Импортировано ${importedProducts.length} товаров из файла ${file.name}`);
                this.showNotification(`Импортировано ${importedProducts.length} товаров`, 'success');
                
            } catch (error) {
                this.log('error', 'Ошибка импорта файла', error);
                this.showNotification('Ошибка импорта файла', 'error');
            }
        };
        
        if (file.name.endsWith('.csv')) {
            reader.readAsText(file, 'utf-8');
        } else {
            reader.readAsBinaryString(file);
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                data.push(row);
            }
        }
        
        return data;
    }

    normalizeImportedData(data) {
        return data.map((row, index) => {
            const product = {
                id: (Date.now() + index).toString(),
                name: row['Название товара'] || row['название'] || row['name'] || `Товар ${index + 1}`,
                description: row['Краткое описание'] || row['описание'] || row['description'] || '',
                quantity: parseInt(row['Количество'] || row['количество'] || row['quantity'] || 0),
                purchasePrice: parseFloat(row['Цена закупа'] || row['цена_закупа'] || row['purchase_price'] || 0),
                salePrice: parseFloat(row['Цена продажи'] || row['цена_продажи'] || row['sale_price'] || 0),
                competitorNewPrice: parseFloat(row['Цена конкурентов NEW'] || row['цена_конкурентов_new'] || 0),
                competitorUsedPrice: parseFloat(row['Цена конкурентов б/у'] || row['цена_конкурентов_бу'] || 0),
                lastUpdated: new Date().toLocaleString('ru-RU')
            };
            
            return product;
        });
    }

    exportToExcel() {
        if (this.products.length === 0) {
            this.showNotification('Нет товаров для экспорта', 'warning');
            return;
        }
        
        try {
            const exportData = this.products.map(product => ({
                'Название товара': product.name,
                'Краткое описание': product.description,
                'Количество': product.quantity,
                'Цена закупа': product.purchasePrice,
                'Цена продажи': product.salePrice,
                'Цена конкурентов NEW': product.competitorNewPrice,
                'Цена конкурентов б/у': product.competitorUsedPrice,
                'Последнее обновление': product.lastUpdated
            }));
            
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Товары');
            
            const filename = `ai_price_analyzer_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, filename);
            
            this.log('info', `Данные экспортированы в файл ${filename}`);
            this.showNotification('Файл Excel создан', 'success');
            
        } catch (error) {
            this.log('error', 'Ошибка экспорта в Excel', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    exportToCsv() {
        if (this.products.length === 0) {
            this.showNotification('Нет товаров для экспорта', 'warning');
            return;
        }
        
        try {
            const headers = [
                'Название товара',
                'Краткое описание',
                'Количество',
                'Цена закупа',
                'Цена продажи',
                'Цена конкурентов NEW',
                'Цена конкурентов б/у',
                'Последнее обновление'
            ];
            
            let csvContent = headers.join(',') + '\n';
            
            this.products.forEach(product => {
                const row = [
                    `"${product.name}"`,
                    `"${product.description}"`,
                    product.quantity,
                    product.purchasePrice,
                    product.salePrice,
                    product.competitorNewPrice,
                    product.competitorUsedPrice,
                    `"${product.lastUpdated}"`
                ];
                csvContent += row.join(',') + '\n';
            });
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `ai_price_analyzer_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.log('info', 'Данные экспортированы в CSV');
            this.showNotification('Файл CSV создан', 'success');
            
        } catch (error) {
            this.log('error', 'Ошибка экспорта в CSV', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    // Отрисовка интерфейса
    renderProducts() {
        const tbody = document.getElementById('productsTableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (this.products.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }
        
        emptyState.style.display = 'none';
        
        tbody.innerHTML = this.products.map(product => `
            <tr data-product-id="${product.id}">
                <td><input type="checkbox" class="product-checkbox" value="${product.id}"></td>
                <td><input type="text" value="${product.name}" onchange="app.updateProduct('${product.id}', 'name', this.value)"></td>
                <td><textarea onchange="app.updateProduct('${product.id}', 'description', this.value)">${product.description}</textarea></td>
                <td><input type="number" value="${product.quantity}" onchange="app.updateProduct('${product.id}', 'quantity', parseInt(this.value))"></td>
                <td><input type="number" step="0.01" value="${product.purchasePrice}" onchange="app.updateProduct('${product.id}', 'purchasePrice', parseFloat(this.value))"></td>
                <td><input type="number" step="0.01" value="${product.salePrice}" onchange="app.updateProduct('${product.id}', 'salePrice', parseFloat(this.value))"></td>
                <td class="price-cell ${product.competitorNewPrice > 0 ? 'has-price' : ''}">${product.competitorNewPrice > 0 ? product.competitorNewPrice.toLocaleString() + ' ₽' : '—'}</td>
                <td class="price-cell ${product.competitorUsedPrice > 0 ? 'has-price' : ''}">${product.competitorUsedPrice > 0 ? product.competitorUsedPrice.toLocaleString() + ' ₽' : '—'}</td>
                <td class="last-updated">${product.lastUpdated || '—'}</td>
                <td class="cell-actions">
                    <button class="btn btn-sm" onclick="app.searchSingleCompetitor('${product.id}')" title="Найти цены конкурентов">🔍</button>
                    <button class="btn btn-sm" onclick="app.searchSingleAvito('${product.id}')" title="Найти на Avito">🛒</button>
                    <button class="btn btn-sm" onclick="app.showProductModal(app.getProduct('${product.id}'))" title="Редактировать">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteProduct('${product.id}')" title="Удалить">🗑️</button>
                </td>
            </tr>
        `).join('');
        
        // Обновляем обработчики чекбоксов
        this.updateBulkActions();
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

    // Одиночный поиск
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

    // Массовые операции
    selectAllProducts() {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
        });
        
        this.updateBulkActions();
    }

    updateBulkActions() {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        
        document.getElementById('bulkCompetitorSearch').disabled = checkedCount === 0;
        document.getElementById('bulkAvitoSearch').disabled = checkedCount === 0;
        
        // Обновляем текст кнопки выбора всех
        const selectAllBtn = document.getElementById('selectAll');
        selectAllBtn.textContent = checkedCount === checkboxes.length ? '☐ Снять все' : '☑️ Выбрать все';
        
        // Добавляем обработчики изменения чекбоксов
        checkboxes.forEach(cb => {
            cb.onchange = () => this.updateBulkActions();
        });
    }

    async bulkSearchCompetitors() {
        const selectedProducts = this.getSelectedProducts();
        if (selectedProducts.length === 0) return;
        
        for (const product of selectedProducts) {
            try {
                await this.searchCompetitorPrices(`найди цену на ${product.name} у конкурентов`);
                // Небольшая пауза между запросами
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                this.log('error', `Ошибка поиска для товара ${product.name}`, error);
            }
        }
    }

    async bulkSearchAvito() {
        const selectedProducts = this.getSelectedProducts();
        if (selectedProducts.length === 0) return;
        
        for (const product of selectedProducts) {
            try {
                await this.searchAvitoPrice(`найди б/у цену на ${product.name}`);
                // Небольшая пауза между запросами
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                this.log('error', `Ошибка поиска на Avito для товара ${product.name}`, error);
            }
        }
    }

    getSelectedProducts() {
        const checkboxes = document.querySelectorAll('.product-checkbox:checked');
        return Array.from(checkboxes).map(cb => {
            return this.products.find(p => p.id === cb.value);
        }).filter(Boolean);
    }

    // Вкладки
    switchTab(tabName) {
        // Удаляем активные классы
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Добавляем активные классы
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
        
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

    // История поиска
    renderHistory() {
        const historyList = document.getElementById('historyList');
        const filter = document.getElementById('historyFilter').value;
        
        let filteredHistory = this.searchHistory;
        if (filter !== 'all') {
            filteredHistory = this.searchHistory.filter(item => item.type === filter);
        }
        
        if (filteredHistory.length === 0) {
            historyList.innerHTML = '<div class="empty-state"><p>История поиска пуста</p></div>';
            return;
        }
        
        historyList.innerHTML = filteredHistory.map(item => `
            <div class="history-item">
                <div class="history-header-info">
                    <span class="history-type ${item.type}">${item.type === 'competitor' ? 'Конкуренты' : 'Avito'}</span>
                    <span class="timestamp">${item.timestamp}</span>
                </div>
                <div class="history-query">
                    <strong>${item.productName}</strong>
                    ${item.minPrice ? `<span class="price-value">${item.minPrice.toLocaleString()} ₽</span>` : ''}
                </div>
                <div class="history-results">
                    <pre>${item.result}</pre>
                </div>
            </div>
        `).join('');
    }

    clearHistory() {
        if (confirm('Очистить всю историю поиска?')) {
            this.searchHistory = [];
            this.saveData();
            this.renderHistory();
            this.log('info', 'История поиска очищена');
            this.showNotification('История очищена', 'success');
        }
    }

    exportHistory() {
        if (this.searchHistory.length === 0) {
            this.showNotification('История поиска пуста', 'warning');
            return;
        }
        
        const exportData = this.searchHistory.map(item => ({
            'Время': item.timestamp,
            'Тип поиска': item.type === 'competitor' ? 'Конкуренты' : 'Avito',
            'Товар': item.productName,
            'Минимальная цена': item.minPrice || 'не найдена',
            'Результат': item.result
        }));
        
        try {
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'История поиска');
            
            const filename = `search_history_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, filename);
            
            this.showNotification('История экспортирована', 'success');
        } catch (error) {
            this.log('error', 'Ошибка экспорта истории', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    // Настройки
    renderSettings() {
        // Загружаем текущие настройки в форму
        document.getElementById('apiKey').value = this.settings.apiKey;
        document.getElementById('gptModel').value = this.settings.gptModel;
        document.getElementById('competitorPrompt').value = this.settings.competitorPrompt;
        document.getElementById('avitoPrompt').value = this.settings.avitoPrompt;
        document.getElementById('editPrompt').value = this.settings.editPrompt;
        
        this.renderColumnsList();
        this.updateAPIStatus();
    }

    renderColumnsList() {
        const columnsList = document.getElementById('columnsList');
        
        const baseColumns = [
            { name: 'Название товара', type: 'text', editable: true, removable: false },
            { name: 'Краткое описание', type: 'text', editable: true, removable: false },
            { name: 'Количество', type: 'number', editable: true, removable: false },
            { name: 'Цена закупа', type: 'currency', editable: true, removable: false },
            { name: 'Цена продажи', type: 'currency', editable: true, removable: false },
            { name: 'Цена конкурентов NEW', type: 'currency', editable: false, removable: false },
            { name: 'Цена конкурентов б/у', type: 'currency', editable: false, removable: false },
            { name: 'Последнее обновление', type: 'date', editable: false, removable: false }
        ];
        
        const allColumns = [...baseColumns, ...this.settings.customColumns];
        
        columnsList.innerHTML = allColumns.map(column => `
            <div class="column-item">
                <div class="column-info">
                    <div class="column-name">${column.name}</div>
                    <div class="column-type">${column.type}</div>
                </div>
                <div class="column-actions">
                    ${column.removable ? `<button class="btn btn-sm btn-danger" onclick="app.removeColumn('${column.name}')">🗑️</button>` : ''}
                </div>
            </div>
        `).join('');
    }

    saveApiSettings() {
        this.settings.apiKey = document.getElementById('apiKey').value.trim();
        this.settings.gptModel = document.getElementById('gptModel').value;
        
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

    savePrompts() {
        this.settings.competitorPrompt = document.getElementById('competitorPrompt').value.trim();
        this.settings.avitoPrompt = document.getElementById('avitoPrompt').value.trim();
        this.settings.editPrompt = document.getElementById('editPrompt').value.trim();
        
        this.saveSettings();
        this.showNotification('Промпты сохранены', 'success');
        this.log('info', 'Промпты AI агентов обновлены');
    }

    resetPrompts() {
        if (confirm('Сбросить все промпты к значениям по умолчанию?')) {
            document.getElementById('competitorPrompt').value = this.getDefaultCompetitorPrompt();
            document.getElementById('avitoPrompt').value = this.getDefaultAvitoPrompt();
            document.getElementById('editPrompt').value = this.getDefaultEditPrompt();
            
            this.showNotification('Промпты сброшены', 'success');
        }
    }

    // Промпты по умолчанию
    getDefaultCompetitorPrompt() {
        return `Ты аналитик цен с доступом к веб-поиску. Найди актуальную минимальную цену на товар "{productName}" у российских конкурентов.

АЛГОРИТМ ПОИСКА:
1. Используй веб-поиск по запросу "{productName} купить цена россия"
2. Проверь основные российские площадки: Wildberries, Ozon, Яндекс.Маркет, DNS, М.Видео, Ситилинк, Эльдорадо
3. Найди РЕАЛЬНЫЕ актуальные цены с действующими ссылками
4. Выбери минимальную цену среди найденных предложений

ФОРМАТ ОТВЕТА:
Минимальная цена: [ЦЕНА] рублей
Источник: [НАЗВАНИЕ_САЙТА]
Ссылка: [URL]
Доступность: [в наличии/под заказ]

Дополнительные предложения:
- [САЙТ]: [ЦЕНА] руб - [ССЫЛКА]
- [САЙТ]: [ЦЕНА] руб - [ССЫЛКА]

Поиск выполнен: [дата и время]

ВАЖНО: Используй только веб-поиск для получения актуальных данных. НЕ используй устаревшие знания из тренировочных данных.`;
    }

    getDefaultAvitoPrompt() {
        return `Найди минимальную цену на б/у товар "{productName}" на площадке Avito.ru по всей России.

АЛГОРИТМ ПОИСКА:
1. Поиск ТОЛЬКО на avito.ru
2. Территория поиска: вся Россия
3. Сортировка: по цене от минимальной к максимальной
4. Состояние товара: б/у, можно рассматривать "как новый"

ФОРМАТ ОТВЕТА:
Минимальная б/у цена: [ЦЕНА] рублей
Состояние: [описание состояния]
Местоположение: [город]
Ссылка: [URL на объявление Avito]
Продавец: [частное лицо/магазин]

Дополнительные предложения:
- [ЦЕНА] руб в [ГОРОДЕ] - [СОСТОЯНИЕ] - [ССЫЛКА]
- [ЦЕНА] руб в [ГОРОДЕ] - [СОСТОЯНИЕ] - [ССЫЛКА]

Статистика поиска:
- Найдено объявлений: [количество]
- Средняя цена: [цена] руб
- Диапазон цен: от [мин] до [макс] руб

ВАЖНО: Ищи только на Avito.ru, используй актуальные данные через веб-поиск.`;
    }

    getDefaultEditPrompt() {
        return `Ты помощник для редактирования данных товаров. Проанализируй команду пользователя и определи какие изменения нужно внести.

ДОСТУПНЫЕ ПОЛЯ для изменения:
- name (название товара)
- description (описание)
- quantity (количество)
- purchasePrice (цена закупа)
- salePrice (цена продажи)

ПРИМЕРЫ КОМАНД:
- "измени количество iPhone на 10" → quantity: 10
- "установи цену продажи Samsung 25000" → salePrice: 25000
- "обнови описание MacBook новая модель" → description: "новая модель"

ФОРМАТ ОТВЕТА:
Если команда понятна и выполнима:
ТОВАР: [название найденного товара]
ПОЛЕ: [поле для изменения]
ЗНАЧЕНИЕ: [новое значение]
ОПИСАНИЕ: [что именно изменяется]

Если команда непонятна:
ОШИБКА: Не удалось определить товар или поле для изменения. Уточните команду.

ПРИМЕРЫ ПРАВИЛЬНОГО АНАЛИЗА:
Команда: "измени количество iPhone 15 на 5"
ТОВАР: iPhone 15
ПОЛЕ: quantity
ЗНАЧЕНИЕ: 5
ОПИСАНИЕ: Изменено количество товара iPhone 15 на 5 штук`;
    }

    // Управление колонками
    showColumnModal() {
        document.getElementById('columnModal').classList.add('active');
        document.getElementById('columnForm').reset();
    }

    hideColumnModal() {
        document.getElementById('columnModal').classList.remove('active');
    }

    addCustomColumn() {
        const form = document.getElementById('columnForm');
        const columnData = {
            name: form.columnName.value.trim(),
            type: form.columnType.value,
            editable: form.columnEditable.checked,
            removable: true
        };
        
        if (!columnData.name) {
            this.showNotification('Введите название колонки', 'error');
            return;
        }
        
        // Проверяем, что колонка не существует
        const exists = this.settings.customColumns.some(col => col.name === columnData.name);
        if (exists) {
            this.showNotification('Колонка с таким названием уже существует', 'error');
            return;
        }
        
        this.settings.customColumns.push(columnData);
        this.saveSettings();
        this.renderColumnsList();
        this.hideColumnModal();
        
        this.showNotification('Колонка добавлена', 'success');
        this.log('info', `Добавлена пользовательская колонка: ${columnData.name}`);
    }

    removeColumn(columnName) {
        if (confirm(`Удалить колонку "${columnName}"?`)) {
            this.settings.customColumns = this.settings.customColumns.filter(col => col.name !== columnName);
            this.saveSettings();
            this.renderColumnsList();
            
            this.showNotification('Колонка удалена', 'success');
            this.log('info', `Удалена пользовательская колонка: ${columnName}`);
        }
    }

    // Логи
    log(level, message, data = null) {
        const logEntry = {
            timestamp: new Date().toLocaleString('ru-RU'),
            level: level,
            message: message,
            data: data
        };
        
        this.logs.unshift(logEntry);
        
        // Ограничиваем количество логов
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(0, 1000);
        }
        
        console.log(`[${level.toUpperCase()}] ${message}`, data || '');
        
        // Если активна вкладка логов, обновляем отображение
        if (document.getElementById('logs').classList.contains('active')) {
            this.renderLogs();
        }
    }

    renderLogs() {
        const logsList = document.getElementById('logsList');
        const levelFilter = document.getElementById('logLevel').value;
        
        let filteredLogs = this.logs;
        if (levelFilter !== 'all') {
            filteredLogs = this.logs.filter(log => log.level === levelFilter);
        }
        
        if (filteredLogs.length === 0) {
            logsList.innerHTML = '<div class="empty-state"><p>Нет логов для отображения</p></div>';
            return;
        }
        
        logsList.innerHTML = filteredLogs.slice(0, 100).map(log => `
            <div class="log-item">
                <div class="log-header-info">
                    <span class="log-level ${log.level}">${log.level.toUpperCase()}</span>
                    <span class="timestamp">${log.timestamp}</span>
                </div>
                <div class="log-message">${log.message}</div>
                ${log.data ? `<pre class="log-data">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
            </div>
        `).join('');
    }

    clearLogs() {
        if (confirm('Очистить все логи?')) {
            this.logs = [];
            this.renderLogs();
            console.clear();
            this.showNotification('Логи очищены', 'success');
        }
    }

    exportLogs() {
        if (this.logs.length === 0) {
            this.showNotification('Нет логов для экспорта', 'warning');
            return;
        }
        
        const exportData = this.logs.map(log => ({
            'Время': log.timestamp,
            'Уровень': log.level,
            'Сообщение': log.message,
            'Данные': log.data ? JSON.stringify(log.data) : ''
        }));
        
        try {
            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Логи системы');
            
            const filename = `system_logs_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(workbook, filename);
            
            this.showNotification('Логи экспортированы', 'success');
        } catch (error) {
            console.error('Ошибка экспорта логов:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    // UI утилиты
    updateUI() {
        this.updateAPIStatus();
        this.updateProductCount();
    }

    updateAPIStatus() {
        const statusElement = document.getElementById('apiStatus');
        
        if (this.settings.apiKey && this.settings.apiKey.startsWith('sk-')) {
            statusElement.textContent = 'API настроен';
            statusElement.className = 'status success';
        } else {
            statusElement.textContent = 'API не настроен';
            statusElement.className = 'status error';
        }
    }

    updateProductCount() {
        document.getElementById('productCount').textContent = `Товаров: ${this.products.length}`;
    }

    addMessage(type, content) {
        const messagesContainer = document.getElementById('dialogMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${content.replace(/\n/g, '<br>')}
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.getElementById('notifications').appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showLoading(message = 'Загрузка...') {
        const loading = document.getElementById('loadingIndicator');
        document.querySelector('.loading-text').textContent = message;
        loading.classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingIndicator').classList.remove('active');
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    filterProducts(query) {
        const rows = document.querySelectorAll('#productsTableBody tr');
        const lowerQuery = query.toLowerCase();
        
        rows.forEach(row => {
            const productName = row.querySelector('input[type="text"]').value.toLowerCase();
            const productDesc = row.querySelector('textarea').value.toLowerCase();
            
            if (productName.includes(lowerQuery) || productDesc.includes(lowerQuery)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
}

// Инициализация приложения
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new AIPriceAnalyzer();
});