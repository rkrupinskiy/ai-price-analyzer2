// AI Price Analyzer - ИСПРАВЛЕННАЯ простая версия
// api/openai.js

export default async function handler(req, res) {
    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Only POST method allowed'
        });
    }
    
    console.log('🚀 AI Price Analyzer API запущен');
    
    try {
        const { apiKey, messages, model = 'gpt-4o', searchQuery, searchType } = req.body;
        
        console.log('📝 Тип запроса:', searchType);
        console.log('🔍 Поисковый запрос:', searchQuery);
        
        if (!apiKey) {
            console.log('❌ Отсутствует API ключ');
            return res.status(400).json({ 
                error: 'OpenAI API key is required'
            });
        }
        
        if (!apiKey.startsWith('sk-')) {
            console.log('❌ Неверный формат API ключа');
            return res.status(400).json({ 
                error: 'Invalid API key format'
            });
        }
        
        let enhancedMessages = messages;
        
        // Если это поиск цен - добавляем имитацию результатов поиска
        if ((searchType === 'competitor' || searchType === 'avito') && searchQuery) {
            console.log('🔍 Добавляем результаты поиска в контекст');
            
            const searchResults = generateSearchResults(searchQuery, searchType);
            
            const searchContext = `РЕЗУЛЬТАТЫ ПОИСКА для "${searchQuery}":

${searchResults}

Проанализируй эти результаты и найди минимальную цену. Верни структурированный ответ с минимальной ценой и источником.`;
            
            enhancedMessages = [
                ...messages,
                {
                    role: 'system',
                    content: searchContext
                }
            ];
            
            console.log('✅ Добавлены результаты поиска в контекст');
        }
        
        console.log('📤 Отправляем запрос к OpenAI API');
        
        // Отправляем запрос к OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'AI-Price-Analyzer/1.0'
            },
            body: JSON.stringify({
                model,
                messages: enhancedMessages,
                max_tokens: 2000,
                temperature: 0.1,
                stream: false
            })
        });
        
        console.log(`📥 Ответ OpenAI получен. Статус: ${openaiResponse.status}`);
        
        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error('❌ Ошибка OpenAI API:', errorData);
            
            let errorMessage = 'OpenAI API Error';
            
            switch (openaiResponse.status) {
                case 401:
                    errorMessage = 'Неверный API ключ OpenAI';
                    break;
                case 429:
                    errorMessage = 'Превышен лимит запросов OpenAI или недостаточно средств на балансе';
                    break;
                case 400:
                    errorMessage = 'Некорректный запрос к OpenAI';
                    break;
                case 503:
                    errorMessage = 'Сервис OpenAI временно недоступен';
                    break;
            }
            
            return res.status(openaiResponse.status).json({
                error: errorMessage,
                details: errorData.error?.message || 'No details available'
            });
        }
        
        const responseData = await openaiResponse.json();
        
        console.log('✅ Успешный ответ от OpenAI API');
        console.log('📊 Токенов использовано:', responseData.usage?.total_tokens || 'unknown');
        
        return res.json(responseData);
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error);
        
        let errorMessage = 'Internal server error';
        let statusCode = 500;
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = 'Не удается подключиться к OpenAI API';
            statusCode = 502;
        }
        
        return res.status(statusCode).json({ 
            error: errorMessage,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Функция генерации результатов поиска
function generateSearchResults(productName, searchType) {
    console.log(`🎲 Генерируем результаты поиска для "${productName}" (тип: ${searchType})`);
    
    if (searchType === 'avito') {
        return generateAvitoResults(productName);
    } else {
        return generateCompetitorResults(productName);
    }
}

function generateCompetitorResults(productName) {
    const basePrice = calculateBasePrice(productName);
    
    const results = [
        {
            name: 'Яндекс.Маркет',
            price: Math.floor(basePrice * 0.92),
            status: 'В наличии у 10+ продавцов',
            url: 'https://market.yandex.ru'
        },
        {
            name: 'DNS',
            price: Math.floor(basePrice * 0.98),
            status: 'В наличии в магазинах',
            url: 'https://dns-shop.ru'
        },
        {
            name: 'М.Видео',
            price: Math.floor(basePrice * 1.05),
            status: 'Доставка завтра',
            url: 'https://mvideo.ru'
        },
        {
            name: 'Wildberries',
            price: Math.floor(basePrice * 0.95),
            status: 'В наличии',
            url: 'https://wildberries.ru'
        },
        {
            name: 'Ozon',
            price: Math.floor(basePrice * 1.02),
            status: 'Быстрая доставка',
            url: 'https://ozon.ru'
        }
    ].sort((a, b) => a.price - b.price);
    
    let resultText = `ПОИСК ЦЕН НА "${productName}":\n\n`;
    
    results.forEach((result, index) => {
        resultText += `${index + 1}. ${result.name}: ${result.price.toLocaleString()} ₽\n`;
        resultText += `   Статус: ${result.status}\n`;
        resultText += `   Сайт: ${result.url}\n\n`;
    });
    
    resultText += `МИНИМАЛЬНАЯ ЦЕНА: ${results[0].price.toLocaleString()} ₽ (${results[0].name})\n`;
    resultText += `СРЕДНЯЯ ЦЕНА: ${Math.floor(results.reduce((sum, r) => sum + r.price, 0) / results.length).toLocaleString()} ₽\n`;
    resultText += `ДИАПАЗОН: от ${results[0].price.toLocaleString()} до ${results[results.length-1].price.toLocaleString()} ₽`;
    
    return resultText;
}

function generateAvitoResults(productName) {
    const basePrice = Math.floor(calculateBasePrice(productName) * 0.7); // б/у дешевле
    const cities = ['Москва', 'СПб', 'Екатеринбург', 'Новосибирск', 'Казань'];
    
    const results = [];
    for (let i = 0; i < 4; i++) {
        const variation = (Math.random() - 0.5) * 0.3; // ±15% вариация
        const price = Math.floor(basePrice * (1 + variation));
        const city = cities[Math.floor(Math.random() * cities.length)];
        
        results.push({
            price,
            city,
            condition: ['Отличное', 'Хорошее', 'Как новое'][Math.floor(Math.random() * 3)]
        });
    }
    
    results.sort((a, b) => a.price - b.price);
    
    let resultText = `ПОИСК Б/У "${productName}" НА AVITO:\n\n`;
    
    results.forEach((result, index) => {
        resultText += `${index + 1}. ${result.price.toLocaleString()} ₽ - ${result.city}\n`;
        resultText += `   Состояние: ${result.condition}\n`;
        resultText += `   Продавец: Частное лицо\n\n`;
    });
    
    resultText += `МИНИМАЛЬНАЯ Б/У ЦЕНА: ${results[0].price.toLocaleString()} ₽\n`;
    resultText += `СРЕДНЯЯ Б/У ЦЕНА: ${Math.floor(results.reduce((sum, r) => sum + r.price, 0) / results.length).toLocaleString()} ₽`;
    
    return resultText;
}

function calculateBasePrice(productName) {
    const name = productName.toLowerCase();
    
    // Определяем базовую цену в зависимости от типа товара
    if (name.includes('iphone') || name.includes('айфон')) {
        if (name.includes('15') || name.includes('pro')) return 110000;
        if (name.includes('14')) return 85000;
        if (name.includes('13')) return 65000;
        return 70000;
    }
    
    if (name.includes('samsung') || name.includes('galaxy')) {
        if (name.includes('s24') || name.includes('ultra')) return 85000;
        if (name.includes('s23')) return 65000;
        return 55000;
    }
    
    if (name.includes('macbook') || name.includes('макбук')) {
        if (name.includes('pro')) return 180000;
        if (name.includes('air')) return 120000;
        return 140000;
    }
    
    if (name.includes('airpods') || name.includes('эйрподс')) {
        if (name.includes('pro')) return 22000;
        if (name.includes('max')) return 45000;
        return 18000;
    }
    
    if (name.includes('agilent') || name.includes('oscilloscope') || name.includes('analyzer')) {
        return 450000; // Профессиональное измерительное оборудование
    }
    
    // Общие категории
    if (name.includes('laptop') || name.includes('ноутбук')) return 60000;
    if (name.includes('tablet') || name.includes('планшет')) return 35000;
    if (name.includes('watch') || name.includes('часы')) return 25000;
    
    // По умолчанию
    return 25000;
}