// frontend/src/components/admin/TemplatesManagement.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TemplatesManagement.css';

/**
 * Компонент управления шаблонами турниров (Админ-панель)
 */
function TemplatesManagement() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Загрузка всех шаблонов
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tournament-templates');
      setTemplates(response.data.templates || []);
      console.log('✅ Загружено шаблонов:', response.data.templates?.length);
    } catch (error) {
      console.error('❌ Ошибка загрузки шаблонов:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Удаление шаблона
  const handleDelete = async (templateId) => {
    if (!window.confirm('Удалить этот шаблон? Это действие нельзя отменить.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/tournament-templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('Шаблон успешно удален');
      fetchTemplates();
    } catch (error) {
      console.error('❌ Ошибка удаления шаблона:', error);
      alert('Ошибка удаления: ' + (error.response?.data?.error || error.message));
    }
  };

  // Редактирование шаблона
  const handleEdit = (template) => {
    setEditingTemplate(template);
  };

  // Сохранение изменений
  const handleSave = async (templateData) => {
    try {
      const token = localStorage.getItem('token');
      
      if (templateData.id) {
        // Обновление существующего
        await axios.put(
          `/api/tournament-templates/${templateData.id}`,
          templateData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Шаблон обновлен');
      } else {
        // Создание нового
        await axios.post(
          '/api/tournament-templates',
          templateData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        alert('Шаблон создан');
      }
      
      setEditingTemplate(null);
      setShowCreateModal(false);
      fetchTemplates();
    } catch (error) {
      console.error('❌ Ошибка сохранения шаблона:', error);
      alert('Ошибка сохранения: ' + (error.response?.data?.error || error.message));
    }
  };

  return (
    <div className="templates-management">
      <div className="templates-header">
        <h2>📋 Управление шаблонами турниров</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingTemplate({
              name: '',
              description: '',
              category: 'custom',
              icon: '🏆',
              is_official: false,
              config: {
                format: 'single',
                bracket_type: 'single_elimination',
                participant_type: 'team',
                team_size: 5,
                max_teams: 16,
                game: 'counter strike 2',
                lobby_enabled: true,
                lobby_match_format: 'bo1',
                final_match_format: null,
                seeding_type: 'random',
                tournament_type: 'open',
              }
            });
            setShowCreateModal(true);
          }}
        >
          + Создать шаблон
        </button>
      </div>

      {/* Статистика */}
      <div className="templates-stats">
        <div className="stat-card">
          <div className="stat-value">{templates.length}</div>
          <div className="stat-label">Всего шаблонов</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {templates.filter(t => t.is_official).length}
          </div>
          <div className="stat-label">Официальных</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {templates.filter(t => !t.is_official).length}
          </div>
          <div className="stat-label">Кастомных</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {templates.reduce((sum, t) => sum + (t.use_count || 0), 0)}
          </div>
          <div className="stat-label">Использований</div>
        </div>
      </div>

      {/* Таблица шаблонов */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Загрузка шаблонов...
        </div>
      ) : (
        <div className="templates-table-wrapper">
          <table className="templates-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Иконка</th>
                <th>Название</th>
                <th>Категория</th>
                <th>Формат</th>
                <th>Сетка</th>
                <th>Команды</th>
                <th>Использований</th>
                <th>Тип</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.id}</td>
                  <td style={{ fontSize: '24px', textAlign: 'center' }}>
                    {template.icon || '🏆'}
                  </td>
                  <td>
                    <strong>{template.name}</strong>
                    <br />
                    <small style={{ color: '#888', fontSize: '12px' }}>
                      {template.description?.substring(0, 60)}...
                    </small>
                  </td>
                  <td>
                    <span className={`category-badge ${template.category}`}>
                      {template.category === 'daily' && '⚡ Ежедневный'}
                      {template.category === 'weekly' && '🏆 Еженедельный'}
                      {template.category === 'monthly' && '👑 Ежемесячный'}
                      {template.category === 'custom' && '🎨 Кастомный'}
                    </span>
                  </td>
                  <td>
                    {template.config.format === 'single' && 'Single'}
                    {template.config.format === 'double' && 'Double'}
                    {template.config.format === 'mix' && 'Mix'}
                  </td>
                  <td>
                    {template.config.bracket_type === 'single_elimination' && 'SE'}
                    {template.config.bracket_type === 'double_elimination' && 'DE'}
                    {template.config.bracket_type === 'swiss' && 'Swiss'}
                  </td>
                  <td>
                    {template.config.team_size}v{template.config.team_size} × {template.config.max_teams || '∞'}
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: '600' }}>
                    {template.use_count || 0}
                  </td>
                  <td>
                    {template.is_official ? (
                      <span className="official-badge-small">Официальный</span>
                    ) : (
                      <span className="custom-badge-small">Кастомный</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn-action edit"
                        onClick={() => handleEdit(template)}
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      {!template.is_official && (
                        <button
                          className="btn-action delete"
                          onClick={() => handleDelete(template.id)}
                          title="Удалить"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка редактирования/создания */}
      {(editingTemplate || showCreateModal) && (
        <TemplateEditorModal
          template={editingTemplate}
          onSave={handleSave}
          onClose={() => {
            setEditingTemplate(null);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * Модалка редактирования шаблона
 */
function TemplateEditorModal({ template, onSave, onClose }) {
  const [formData, setFormData] = useState(template || {});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfigChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      config: { ...prev.config, [field]: value }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content template-editor" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{formData.id ? 'Редактирование шаблона' : 'Создание шаблона'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h4>Основная информация</h4>
            
            <div className="form-group">
              <label>Название *</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Например: Daily Cup"
                required
              />
            </div>

            <div className="form-group">
              <label>Описание</label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Краткое описание шаблона..."
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Категория *</label>
                <select
                  value={formData.category || 'custom'}
                  onChange={(e) => handleChange('category', e.target.value)}
                  required
                >
                  <option value="daily">⚡ Ежедневный</option>
                  <option value="weekly">🏆 Еженедельный</option>
                  <option value="monthly">👑 Ежемесячный</option>
                  <option value="custom">🎨 Кастомный</option>
                </select>
              </div>

              <div className="form-group">
                <label>Иконка</label>
                <input
                  type="text"
                  value={formData.icon || ''}
                  onChange={(e) => handleChange('icon', e.target.value)}
                  placeholder="Emoji"
                  maxLength="10"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_official || false}
                  onChange={(e) => handleChange('is_official', e.target.checked)}
                />
                <span>Официальный шаблон</span>
              </label>
            </div>
          </div>

          <div className="form-section">
            <h4>Конфигурация турнира</h4>

            <div className="form-row">
              <div className="form-group">
                <label>Формат *</label>
                <select
                  value={formData.config?.format || 'single'}
                  onChange={(e) => handleConfigChange('format', e.target.value)}
                  required
                >
                  <option value="single">Single Elimination</option>
                  <option value="double">Double Elimination</option>
                  <option value="mix">Mix</option>
                </select>
              </div>

              <div className="form-group">
                <label>Тип сетки *</label>
                <select
                  value={formData.config?.bracket_type || 'single_elimination'}
                  onChange={(e) => handleConfigChange('bracket_type', e.target.value)}
                  required
                >
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                  <option value="swiss">Swiss System</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Размер команды *</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.config?.team_size || 5}
                  onChange={(e) => handleConfigChange('team_size', parseInt(e.target.value, 10))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Максимум команд</label>
                <input
                  type="number"
                  min="4"
                  max="128"
                  value={formData.config?.max_teams || ''}
                  onChange={(e) => handleConfigChange('max_teams', e.target.value ? parseInt(e.target.value, 10) : null)}
                  placeholder="Не ограничено"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Формат матчей</label>
                <select
                  value={formData.config?.lobby_match_format || ''}
                  onChange={(e) => handleConfigChange('lobby_match_format', e.target.value || null)}
                >
                  <option value="">Выбор в лобби</option>
                  <option value="bo1">Best of 1</option>
                  <option value="bo3">Best of 3</option>
                  <option value="bo5">Best of 5</option>
                </select>
              </div>

              <div className="form-group">
                <label>Формат финала</label>
                <select
                  value={formData.config?.final_match_format || ''}
                  onChange={(e) => handleConfigChange('final_match_format', e.target.value || null)}
                >
                  <option value="">Как обычные матчи</option>
                  <option value="bo1">Best of 1</option>
                  <option value="bo3">Best of 3</option>
                  <option value="bo5">Best of 5</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Длительность (рекомендуемая)</label>
              <input
                type="text"
                value={formData.config?.recommended_duration || ''}
                onChange={(e) => handleConfigChange('recommended_duration', e.target.value)}
                placeholder="Например: 3-4 часа"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary">
              {formData.id ? 'Сохранить изменения' : 'Создать шаблон'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TemplatesManagement;

