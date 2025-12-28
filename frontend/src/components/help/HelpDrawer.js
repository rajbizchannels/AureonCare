import React, { useState, useEffect } from 'react';
import { X, Search, Book, HelpCircle, MessageCircle, Lightbulb } from 'lucide-react';

const HelpDrawer = ({ theme, isOpen, onClose, currentContext, userRole, onOpenAI }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [documentation, setDocumentation] = useState(null);
  const [filteredArticles, setFilteredArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [activeTab, setActiveTab] = useState('search'); // search, context, recent

  // Load documentation index
  useEffect(() => {
    fetch('/docs/documentation-index.json')
      .then(res => res.json())
      .then(data => setDocumentation(data))
      .catch(err => console.error('Failed to load documentation:', err));
  }, []);

  // Filter articles based on search query
  useEffect(() => {
    if (!documentation || !searchQuery) {
      setFilteredArticles([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = [];

    documentation.sections.forEach(section => {
      section.articles.forEach(article => {
        // Check if article is accessible for user role
        if (article.roles.includes('all') || article.roles.includes(userRole)) {
          // Search in title, keywords, and content
          const matchScore =
            (article.title.toLowerCase().includes(query) ? 10 : 0) +
            (article.keywords.some(k => k.includes(query)) ? 5 : 0) +
            (article.content.toLowerCase().includes(query) ? 1 : 0);

          if (matchScore > 0) {
            results.push({ ...article, section: section.title, score: matchScore });
          }
        }
      });
    });

    // Sort by relevance
    results.sort((a, b) => b.score - a.score);
    setFilteredArticles(results.slice(0, 10)); // Top 10 results
  }, [searchQuery, documentation, userRole]);

  // Get contextual help for current page
  const getContextualHelp = () => {
    if (!documentation || !currentContext) return null;
    return documentation.contextualHelp[currentContext];
  };

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Prevent body scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const contextualHelp = getContextualHelp();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 xl:w-2/5 z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'} shadow-2xl`}>

        {/* Header */}
        <div className={`p-6 border-b ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Help & Documentation
                </h2>
                <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                  Version 1.1
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'hover:bg-slate-700' : 'hover:bg-gray-200'
              }`}
            >
              <X className={`w-5 h-5 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`} />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${
              theme === 'dark' ? 'text-slate-500' : 'text-gray-400'
            }`} />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'search'
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="text-sm font-medium">Search</span>
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'context'
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span className="text-sm font-medium">This Page</span>
            </button>
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'browse'
                  ? 'bg-blue-500 text-white'
                  : theme === 'dark'
                  ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              <Book className="w-4 h-4" />
              <span className="text-sm font-medium">Browse</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Search Results Tab */}
          {activeTab === 'search' && (
            <div>
              {searchQuery && filteredArticles.length > 0 ? (
                <div className="space-y-3">
                  <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                    Found {filteredArticles.length} results
                  </p>
                  {filteredArticles.map((article, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedArticle(article)}
                      className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        theme === 'dark'
                          ? 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Book className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-medium mb-1 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {article.title}
                          </h3>
                          <p className={`text-sm mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-gray-600'}`}>
                            {article.content}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {article.section}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-12">
                  <Search className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    No results found
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    Try different keywords or browse topics
                  </p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    Search for help
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    Type keywords to find relevant documentation
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Contextual Help Tab */}
          {activeTab === 'context' && (
            <div>
              {contextualHelp ? (
                <div className={`p-6 rounded-lg border ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-blue-50 border-blue-200'
                }`}>
                  <div className="flex items-start gap-3 mb-4">
                    <Lightbulb className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {contextualHelp.title}
                      </h3>
                      <p className={`${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                        {contextualHelp.content}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Find and show full article
                      const article = documentation.sections
                        .flatMap(s => s.articles)
                        .find(a => a.id === contextualHelp.articleId);
                      if (article) setSelectedArticle(article);
                    }}
                    className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center gap-2"
                  >
                    <Book className="w-4 h-4" />
                    Read full documentation
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Lightbulb className={`w-12 h-12 mx-auto mb-4 ${theme === 'dark' ? 'text-slate-600' : 'text-gray-400'}`} />
                  <p className={`font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                    No contextual help available
                  </p>
                  <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                    Navigate to a specific feature to see relevant help
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Browse Tab */}
          {activeTab === 'browse' && documentation && (
            <div className="space-y-4">
              {documentation.sections.map((section, index) => (
                <div key={index} className={`p-4 rounded-lg border ${
                  theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'
                }`}>
                  <h3 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  }`}>
                    <span>{section.icon}</span>
                    {section.title}
                  </h3>
                  <div className="space-y-2">
                    {section.articles
                      .filter(article => article.roles.includes('all') || article.roles.includes(userRole))
                      .map((article, articleIndex) => (
                        <button
                          key={articleIndex}
                          onClick={() => setSelectedArticle(article)}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                            theme === 'dark'
                              ? 'hover:bg-slate-700 text-slate-300'
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <p className="font-medium text-sm">{article.title}</p>
                          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
                            {article.content}
                          </p>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
          <button
            onClick={() => {
              if (onOpenAI) {
                onOpenAI();
              }
            }}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors ${
              theme === 'dark'
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="font-medium">Ask AI Assistant</span>
          </button>
          <p className={`text-center text-xs mt-2 ${theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}`}>
            Press ESC to close • MedFlow v1.1
          </p>
        </div>
      </div>

      {/* Article Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className={`max-w-3xl w-full max-h-[90vh] rounded-xl overflow-hidden ${
            theme === 'dark' ? 'bg-slate-900' : 'bg-white'
          }`}>
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
                <p className={`whitespace-pre-line ${theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}`}>
                  {selectedArticle.content}
                </p>
                {selectedArticle.url && (
                  <div className="mt-6">
                    <a
                      href={selectedArticle.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                        theme === 'dark'
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      <Book className="w-4 h-4" />
                      Read Full Documentation
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

export default HelpDrawer;
