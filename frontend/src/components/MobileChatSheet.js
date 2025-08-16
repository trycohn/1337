import React, { useRef, useEffect } from 'react';
import ChatList from './ChatList';
import './MobileChatSheet.css';

function MobileChatSheet({
	isOpen,
	onClose,
	chats,
	activeChat,
	unreadCounts,
	onChatSelect,
	onCreateChat,
	dragDx = 0,
	isDraggingOpen = false
}) {
	const panelRef = useRef(null);
	const startXRef = useRef(null);
	const panelWidthRef = useRef(320);

	useEffect(() => {
		if (panelRef.current) {
			panelWidthRef.current = panelRef.current.offsetWidth || 320;
		}
		function onResize() {
			if (panelRef.current) panelWidthRef.current = panelRef.current.offsetWidth || 320;
		}
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		function onKey(e) {
			if (e.key === 'Escape') onClose();
		}
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [isOpen, onClose]);

	function handleOverlayClick(e) {
		if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
	}

	function handleTouchStart(e) {
		startXRef.current = e.touches[0].clientX;
	}

	function handleTouchMove(e) {
		if (startXRef.current == null) return;
		const dx = e.touches[0].clientX - startXRef.current;
		if (dx > 20 && panelRef.current) {
			panelRef.current.style.transform = `translateX(${Math.min(dx, 80)}px)`; // визуальный отклик
		}
	}

	function handleTouchEnd(e) {
		if (startXRef.current == null) return;
		const endX = e.changedTouches[0].clientX;
		const dx = endX - startXRef.current;
		startXRef.current = null;
		if (panelRef.current) panelRef.current.style.transform = '';
		if (dx > 60) onClose();
	}

	const dynamicStyle = isDraggingOpen && panelRef.current
		? { transform: `translateX(${Math.min(Math.max(dragDx, 0), panelWidthRef.current) - panelWidthRef.current}px)`, transition: 'none' }
		: undefined;

	return (
		<div className={`chat-sheet-overlay ${isOpen ? 'open' : ''}`} onClick={handleOverlayClick}>
			<div
				ref={panelRef}
				className={`chat-sheet-panel ${isOpen ? 'open' : ''} ${isDraggingOpen ? 'dragging' : ''}`}
				role="dialog"
				aria-modal="true"
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				style={dynamicStyle}
			>
				<div className="chat-sheet-header">
					<h3>Сообщения</h3>
					<button className="chat-sheet-close" onClick={onClose} aria-label="Закрыть">✕</button>
				</div>
				<div className="chat-sheet-content">
					<ChatList
						chats={chats}
						activeChat={activeChat}
						onChatSelect={(chat) => { onChatSelect(chat); onClose(); }}
						unreadCounts={unreadCounts}
						onCreateChat={onCreateChat}
					/>
				</div>
			</div>
		</div>
	);
}

export default MobileChatSheet;


