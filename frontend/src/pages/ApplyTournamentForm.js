// frontend/src/pages/ApplyTournamentForm.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ApplyTournamentForm.css';

function ApplyTournamentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ enabled: false, fields: [], min_age: '', fill_mode: 'all' });
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const res = await axios.get(`/api/tournaments/${id}/application-form`);
        const cfg = res.data?.config || {};
        setConfig({ enabled: !!cfg.enabled, fields: Array.isArray(cfg.fields) ? cfg.fields : [], min_age: cfg.min_age || '', fill_mode: cfg.fill_mode || 'all' });
      } catch (e) {
        setError('Не удалось загрузить конфигурацию анкеты');
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, [id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/auth');
        return;
      }
      const payload = { ...form };
      const res = await axios.post(`/api/tournaments/${id}/applications`, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setMessage('Анкета отправлена. Статус: на модерации. Вы можете закрыть вкладку.');
      } else {
        setError('Не удалось отправить анкету');
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка отправки анкеты');
    }
  };

  if (loading) return <div className="apply-form-container">Загрузка анкеты...</div>;
  if (!config.enabled) return <div className="apply-form-container">Анкета не требуется для этого турнира</div>;

  const fieldDefs = {
    last_name: { label: 'Фамилия', type: 'text', placeholder: 'Иванов' },
    first_name: { label: 'Имя', type: 'text', placeholder: 'Иван' },
    middle_name: { label: 'Отчество', type: 'text', placeholder: 'Иванович' },
    date_of_birth: { label: 'Дата рождения', type: 'date' },
    region: { label: 'Регион проживания', type: 'text', placeholder: 'Москва' },
    vk_url: { label: 'VK', type: 'url', placeholder: 'https://vk.com/...' },
    telegram_url: { label: 'Telegram', type: 'url', placeholder: 'https://t.me/username' },
    phone: { label: 'Телефон', type: 'tel', placeholder: '+7...' },
    steam_url: { label: 'Steam', type: 'url', placeholder: 'https://steamcommunity.com/id/...' },
    faceit_url: { label: 'FACEIT', type: 'url', placeholder: 'https://www.faceit.com/...' }
  };

  return (
    <div className="apply-form-container">
      <h2 className="apply-form-title">Анкета участника</h2>
      <p className="apply-form-subtitle">Заполните поля. После отправки анкета уйдёт на модерацию организатору.</p>
      {error && <div className="apply-alert error">{error}</div>}
      {message && <div className="apply-alert success">{message}</div>}
      <form onSubmit={onSubmit} className="apply-form">
        <div className="apply-grid">
          {config.fields.map((f) => {
            const def = fieldDefs[f.key] || { label: f.key, type: 'text' };
            return (
              <div key={f.key} className="apply-field">
                <label className="apply-label">{def.label}{f.required ? ' *' : ''}</label>
                <input
                  type={def.type}
                  value={form[f.key] || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={def.placeholder || ''}
                  className="apply-input"
                  required={!!f.required}
                />
              </div>
            );
          })}
        </div>
        <div className="apply-actions">
          <button type="submit" className="btn btn-primary apply-submit">Отправить анкету</button>
          <button type="button" className="btn btn-secondary apply-cancel" onClick={() => window.close()}>Закрыть</button>
        </div>
      </form>
    </div>
  );
}

export default ApplyTournamentForm;


