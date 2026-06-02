// src/features/settings/modal.tsx
import React, { useEffect } from "react";
import ReactDOM from "react-dom";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
	// Fecha com Escape
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		if (isOpen) document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, onClose]);

	// Bloqueia scroll da página enquanto o modal está aberto.
	// O cleanup garante que o overflow seja restaurado ao fechar.
	useEffect(() => {
		if (!isOpen) return;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, [isOpen]);

	if (!isOpen) return null;

	return ReactDOM.createPortal(
		<div className="modal-overlay" onMouseDown={onClose} role="presentation">
			<div
				className="modal-content"
				role="dialog"
				aria-modal="true"
				aria-label={title ?? "Modal"}
				onMouseDown={(e) => e.stopPropagation()}
			>
				<header className="modal-header">
					<h2 className="modal-title">{title}</h2>
					<button className="modal-close" aria-label="Fechar" onClick={onClose}>
						×
					</button>
				</header>

				<div className="modal-body">{children}</div>
			</div>
		</div>,
		document.body,
	);
}
