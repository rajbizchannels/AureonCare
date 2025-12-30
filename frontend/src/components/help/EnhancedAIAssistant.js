import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, MessageSquare, Send, Book, Sparkles } from 'lucide-react';

const EnhancedAIAssistant = ({
  theme,
  tasks,
  onClose,
  onSelectItem,
  onSelectModule,
  currentContext
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [documentation, setDocumentation] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const messagesEndRef = useRef(null);

  // Parse simple markdown to HTML
  const parseMarkdown = (text) => {
    if (!text) return '';

    // Convert **text** to <strong>text</strong>
    let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Convert line breaks to <br> for proper display
    parsed = parsed.replace(/\n/g, '<br />');

    return parsed;
  };

  // Load documentation for context
  useEffect(() => {
    fetch('/docs/documentation-index.json')
      .then(res => res.json())
      .then(data => setDocumentation(data))
      .catch(err => console.error('Failed to load documentation:', err));
  }, []);

  // Initial welcome message
  useEffect(() => {
    setMessages([
      {
        type: 'ai',
        content: "👋 Hi! I'm your MedFlow AI Assistant. I can help you with:\n\n• Finding features and documentation\n• Answering questions about workflows\n• Providing contextual help\n• Suggesting best practices\n\nHow can I help you today?",
        timestamp: new Date()
      }
    ]);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [onClose]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI response (in production, this would call your AI API)
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputMessage);
      setMessages(prev => [...prev, {
        type: 'ai',
        content: aiResponse.content,
        suggestions: aiResponse.suggestions,
        articles: aiResponse.articles,
        timestamp: new Date()
      }]);
      setIsTyping(false);
    }, 1000);
  };

  const generateAIResponse = (query) => {
    const lowerQuery = query.toLowerCase();

    // Search documentation for relevant articles
    const relevantArticles = documentation ?
      documentation.sections.flatMap(section =>
        section.articles.filter(article =>
          article.keywords.some(keyword => lowerQuery.includes(keyword)) ||
          article.title.toLowerCase().includes(lowerQuery)
        ).map(article => ({ ...article, section: section.title }))
      ).slice(0, 3) : [];

    // Generate contextual response
    if (lowerQuery.includes('waitlist') || lowerQuery.includes('wait list')) {
      return {
        content: "The waitlist feature is now integrated into Practice Management! 🎯\n\nTo access it:\n1. Go to Practice Management module\n2. Click the 'Waitlist' tab (next to List and Calendar)\n3. You'll see all patients with status tracking\n\nKey features:\n• Auto-notification when slots open\n• Priority management (High/Medium/Low)\n• Status tracking (Active/Notified/Scheduled/Cancelled/Expired)\n• One-click appointment confirmation",
        suggestions: ['How to add patient to waitlist?', 'Waitlist notification settings', 'Waitlist priority levels'],
        articles: relevantArticles
      };
    }

    if (lowerQuery.includes('prescription') || lowerQuery.includes('eprescribe')) {
      return {
        content: "The ePrescribe modal provides a step-by-step workflow! 💊\n\nNew in v1.1:\n• Edit mode now prefills the medication name\n• Navigate between steps while maintaining context\n• Drug interaction checking built-in\n• Link prescriptions to diagnoses\n\nSteps:\n1. Search for medication\n2. Enter prescription details\n3. Select pharmacy\n4. Review and submit",
        suggestions: ['How to edit prescriptions?', 'Drug interaction checking', 'Link prescription to diagnosis'],
        articles: relevantArticles
      };
    }

    if (lowerQuery.includes('lab') && (lowerQuery.includes('order') || lowerQuery.includes('test'))) {
      return {
        content: "Lab orders have been enhanced with advanced features! 🔬\n\nNew features:\n• CPT code multiselect (80+ common tests)\n• Recurring orders (daily, weekly, monthly)\n• Future scheduling\n• Collection method (clinic vs. lab)\n• Result recipients (multiselect)\n• Print functionality\n\nThe lab order form now makes it easy to order multiple related tests in one order!",
        suggestions: ['How to create lab orders?', 'CPT code search', 'Recurring lab orders'],
        articles: relevantArticles
      };
    }

    if (lowerQuery.includes('appointment') && lowerQuery.includes('schedule')) {
      return {
        content: "Scheduling appointments is easy! 📅\n\nQuick steps:\n1. Go to Practice Management\n2. Click 'New Appointment'\n3. Select patient and provider\n4. Choose date/time\n5. System checks for conflicts automatically\n\nThe calendar has three views: Day, Week, and Month. You can also manage the waitlist from the same module.",
        suggestions: ['Calendar views', 'Recurring appointments', 'Appointment reminders'],
        articles: relevantArticles
      };
    }

    // Default response with documentation search
    if (relevantArticles.length > 0) {
      return {
        content: `I found some relevant documentation that might help! 📚\n\nBased on your question, you might want to check out the articles below.`,
        suggestions: ['Tell me more', 'Show related topics'],
        articles: relevantArticles
      };
    }

    return {
      content: "I can help you with:\n\n• Appointment scheduling and waitlist\n• Patient management and registration\n• ePrescribe and medication management\n• Lab orders with CPT codes\n• Pharmacy and laboratory directories\n• Claims and payment processing\n• Reports and analytics\n\nTry asking about a specific feature, and I'll provide detailed guidance!",
      suggestions: ['How to create appointments?', 'What's new in v1.1?', 'Show me help topics'],
      articles: []
    };
  };

  const handleSuggestionClick = (suggestion) => {
    setInputMessage(suggestion);
  };

  return (
    <>
    <div className={`fixed bottom-24 right-6 w-96 rounded-xl border shadow-2xl z-[55] ${
      theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className={`p-4 border-b bg-gradient-to-r from-blue-500/10 to-cyan-500/10 ${
        theme === 'dark' ? 'border-slate-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center relative">
            <Bot className="w-5 h-5 text-white" />
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          </div>
          <div className="flex-1">
            <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              AI Assistant
            </h3>
            <p className="text-cyan-500 text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Powered by MedFlow Docs
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
          >
            <X className={`w-4 h-4 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="h-96 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${
              message.type === 'user'
                ? theme === 'dark' ? 'bg-blue-600' : 'bg-blue-500'
                : theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'
            } rounded-lg p-3`}>
              <div
                className={`text-sm ${
                  message.type === 'user'
                    ? 'text-white'
                    : theme === 'dark' ? 'text-slate-300' : 'text-gray-800'
                }`}
                dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
              />

              {/* Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`block w-full text-left text-xs px-3 py-2 rounded ${
                        theme === 'dark'
                          ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200'
                      }`}
                    >
                      💬 {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Related Articles */}
              {message.articles && message.articles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    📚 Related Documentation:
                  </p>
                  {message.articles.map((article, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedArticle(article)}
                      className={`w-full text-left text-xs px-3 py-2 rounded cursor-pointer transition-colors ${
                        theme === 'dark'
                          ? 'bg-slate-700 hover:bg-slate-600'
                          : 'bg-white border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Book className={`w-3 h-3 mt-0.5 flex-shrink-0 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-500'}`} />
                        <div className="flex-1">
                          <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {article.title}
                          </p>
                          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                            {article.section}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <p className={`text-xs mt-2 ${
                message.type === 'user'
                  ? 'text-blue-200'
                  : theme === 'dark' ? 'text-slate-500' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className={`rounded-lg p-3 ${theme === 'dark' ? 'bg-slate-800' : 'bg-gray-100'}`}>
              <div className="flex gap-1">
                <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-slate-500' : 'bg-gray-500'}`} style={{ animationDelay: '0ms' }} />
                <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-slate-500' : 'bg-gray-500'}`} style={{ animationDelay: '150ms' }} />
                <div className={`w-2 h-2 rounded-full animate-bounce ${theme === 'dark' ? 'bg-slate-500' : 'bg-gray-500'}`} style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask me anything..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-blue-500 ${
              theme === 'dark'
                ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className={`px-4 py-2 rounded-lg transition-colors ${
              inputMessage.trim()
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : theme === 'dark'
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
          💡 Try asking about waitlist, ePrescribe, or lab orders
        </p>
      </div>
    </div>

    {/* Article Modal */}
    {selectedArticle && (
      <div className="fixed inset-0 bg-black/50 z-[65] flex items-center justify-center p-4" onClick={() => setSelectedArticle(null)}>
        <div
          className={`max-w-3xl w-full max-h-[90vh] rounded-xl overflow-hidden ${
            theme === 'dark' ? 'bg-slate-900' : 'bg-white'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  {selectedArticle.title}
                </h2>
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  {selectedArticle.section}
                </p>
              </div>
              <button
                onClick={() => setSelectedArticle(null)}
                className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-slate-800' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className={`prose ${theme === 'dark' ? 'prose-invert' : ''} max-w-none`}>
              <div
                className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}
                dangerouslySetInnerHTML={{ __html: parseMarkdown(selectedArticle.content) }}
                style={{
                  lineHeight: '1.75',
                  fontSize: '0.95rem'
                }}
              />
              {selectedArticle.url && (
                <div className="mt-6">
                  <a
                    href={`${selectedArticle.url}${selectedArticle.url.includes('?') ? '&' : '?'}help=true`}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                      theme === 'dark'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    <Book className="w-4 h-4" />
                    View Complete Guide
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default EnhancedAIAssistant;
