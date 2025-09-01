// AI Price Analyzer - Serverless функция для Vercel
// api/openai.js

export default async function handler(req, res) {
    // CORS заголовки для работы из браузера
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Обработка preflight запроса
    if (req.method === 'OPTIONS') {
        console.log('✅ CORS preflight запрос обработан');
        return res.status(200).end();
    }
    
    // Принимаем только POST запросы
    if (req.method !== 'POST') {
        console.log(`❌ Неподдерживаемый метод: ${req.method}`);
        return res.status(405).json({ 
            error: 'Only POST method allowed',
            received: req.method
        });
    }
    
    console.log('🚀 AI Price Analyzer - Serverless функция запущена');
    console.log(`📊 Время запроса: ${new Date().toISOString()}`);
    
    try {
        // Парсим тело запроса
        let requestBody;
        if (typeof req.body === 'string') {
            requestBody = JSON.parse(req.body);
        } else {
            requestBody = req.body;
        }
        
        const { 
            apiKey, 
            messages, 
            model = 'gpt-4o', 
            temperature = 0.1, 
            maxTokens = 3000 
        } = requestBody;
        
        // Подробная валидация
        console.log('📋 Валидация входных данных...');
        
        if (!apiKey) {
            console.log('❌ Отсутствует API ключ');
            return res.status(400).json({ 
                error: 'OpenAI API key is required',
                code: 'MISSING_API_KEY'
            });
        }
        
        if (!apiKey.startsWith('sk-')) {
            console.log(`❌ Неверный формат API ключа: ${apiKey.substring(0, 10)}...`);
            return res.status(400).json({ 
                error: 'API key must start with "sk-"',
                code: 'INVALID_API_KEY_FORMAT'
            });
        }
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            console.log('❌ Отсутствуют или некорректные messages');
            return res.status(400).json({ 
                error: 'Messages array is required and should not be empty',
                code: 'MISSING_MESSAGES'
            });
        }
        
        console.log(`✅ Валидация пройдена успешно`);
        console.log(`📝 Параметры запроса:`, {
            model,
            temperature,
            maxTokens,
            messagesCount: messages.length
        });
        
        // Логируем системный промпт для прозрачности (первые 300 символов)
        if (messages[0] && messages[0].role === 'system') {
            const systemPromptPreview = messages[0].content.substring(0, 300);
            console.log(`🤖 Системный промпт: ${systemPromptPreview}...`);
        }
        
        // Логируем пользовательский запрос
        const userMessage = messages.find(msg => msg.role === 'user');
        if (userMessage) {
            console.log(`👤 Пользовательский запрос: ${userMessage.content}`);
        }
        
        // Формируем запрос к OpenAI API
        const openaiPayload = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: false,
            presence_penalty: 0,
            frequency_penalty: 0
        };
        
        console.log('📤 Отправляем запрос к OpenAI API...');
        console.log('🔗 URL: https://api.openai.com/v1/chat/completions');
        
        // Отправляем запрос к OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'User-Agent': 'AI-Price-Analyzer/2.0'
            },
            body: JSON.stringify(openaiPayload)
        });
        
        console.log(`📥 Ответ OpenAI получен. Статус: ${openaiResponse.status}`);
        
        const responseData = await openaiResponse.json();
        
        if (!openaiResponse.ok) {
            console.error('❌ Ошибка от OpenAI API:', {
                status: openaiResponse.status,
                error: responseData.error
            });
            
            // Детальная обработка ошибок OpenAI
            let errorMessage = 'OpenAI API Error';
            let errorCode = 'OPENAI_ERROR';
            
            switch (openaiResponse.status) {
                case 401:
                    errorMessage = 'Неверный API ключ OpenAI или нет доступа';
                    errorCode = 'INVALID_API_KEY';
                    break;
                case 429:
                    errorMessage = 'Превышен лимит запросов OpenAI или недостаточно средств';
                    errorCode = 'RATE_LIMIT_EXCEEDED';
                    break;
                case 400:
                    errorMessage = 'Некорректный запрос к OpenAI API';
                    errorCode = 'BAD_REQUEST';
                    break;
                case 503:
                    errorMessage = 'Сервис OpenAI временно недоступен';
                    errorCode = 'SERVICE_UNAVAILABLE';
                    break;
                default:
                    errorMessage = 'Неизвестная ошибка OpenAI API';
                    errorCode = 'UNKNOWN_OPENAI_ERROR';
            }
            
            return res.status(openaiResponse.status).json({
                error: errorMessage,
                code: errorCode,
                details: responseData.error?.message || 'No additional details',
                openaiStatus: openaiResponse.status
            });
        }
        
        // Успешный ответ
        console.log('✅ Успешный ответ от OpenAI API');
        console.log('📊 Статистика использования:', {
            promptTokens: responseData.usage?.prompt_tokens || 'unknown',
            completionTokens: responseData.usage?.completion_tokens || 'unknown', 
            totalTokens: responseData.usage?.total_tokens || 'unknown'
        });
        
        // Логируем содержимое ответа (первые 500 символов)
        const responseContent = responseData.choices?.[0]?.message?.content || '';
        console.log(`📄 Содержимое ответа (первые 500 символов): ${responseContent.substring(0, 500)}...`);
        
        // Проверяем является ли ответ JSON (для структурированных результатов)
        let isStructuredResponse = false;
        try {
            JSON.parse(responseContent);
            isStructuredResponse = true;
            console.log('✅ Ответ содержит валидный JSON (структурированные данные)');
        } catch {
            console.log('ℹ️ Ответ в текстовом формате');
        }
        
        // Дополняем ответ метаданными для клиента
        const enhancedResponse = {
            ...responseData,
            _metadata: {
                timestamp: new Date().toISOString(),
                processingTime: 'completed',
                isStructured: isStructuredResponse,
                serverlessVersion: '2.0',
                model: model,
                tokensUsed: responseData.usage?.total_tokens || 0
            }
        };
        
        return res.status(200).json(enhancedResponse);
        
    } catch (error) {
        console.error('💥 Критическая ошибка в serverless функции:', {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : 'stack hidden'
        });
        
        // Классификация ошибок для лучшей диагностики
        let errorType = 'UNKNOWN_ERROR';
        let statusCode = 500;
        let userMessage = 'Внутренняя ошибка сервера';
        
        if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
            errorType = 'JSON_PARSE_ERROR';
            statusCode = 400;
            userMessage = 'Ошибка парсинга JSON в запросе';
        } else if (error.code === 'ENOTFOUND') {
            errorType = 'NETWORK_ERROR';
            statusCode = 502;
            userMessage = 'Сетевая ошибка: не удается подключиться к OpenAI';
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorType = 'FETCH_ERROR';
            statusCode = 502;
            userMessage = 'Ошибка выполнения запроса к OpenAI API';
        } else if (error.message.includes('timeout')) {
            errorType = 'TIMEOUT_ERROR';
            statusCode = 504;
            userMessage = 'Превышено время ожидания ответа от OpenAI';
        }
        
        return res.status(statusCode).json({ 
            error: userMessage,
            code: errorType,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-vercel-id'] || 'unknown',
            debug: process.env.NODE_ENV === 'development' ? {
                originalError: error.message,
                errorName: error.name
            } : undefined
        });
    }
}

// Дополнительная конфигурация для Vercel
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '1mb',
        },
        responseLimit: '8mb'
    },
    maxDuration: 30 // максимум 30 секунд на запрос
};

// Информация о версии для мониторинга
export const version = {
    name: 'AI Price Analyzer OpenAI Proxy',
    version: '2.0.0',
    author: 'AI Price Analyzer System',
    description: 'Serverless функция для проксирования запросов к OpenAI API с полным логированием',
    features: [
        'CORS поддержка',
        'Подробное логирование',
        'Валидация входных данных',
        'Обработка ошибок OpenAI',
        'Классификация ошибок',
        'Метаданные ответов'
    ]
};