// src/components/Modal.tsx
import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children?: React.ReactNode;
}

/** Elementos que recebem foco pelo Tab. */
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
	const dialogRef = useRef<HTMLDivElement>(null);

	// Prende o Tab dentro do diálogo: `aria-modal` sozinho não impede o teclado de
	// sair para a página por trás. Do último elemento volta ao primeiro; com Shift,
	// do primeiro (ou do próprio diálogo) vai ao último. No meio do caminho o
	// navegador cuida do Tab normalmente.
	function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
		if (e.key !== "Tab") return;
		const dialog = dialogRef.current;
		if (!dialog) return;
		const items = Array.from(
			dialog.querySelectorAll<HTMLElement>(FOCUSABLE),
		).filter((el) => el.getClientRects().length > 0);
		if (items.length === 0) {
			e.preventDefault();
			dialog.focus({ preventScroll: true });
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || active === dialog)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	// Fecha com Escape
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		if (isOpen) document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, onClose]);

	// Foco: ao abrir, leva o foco para o diálogo (leitores de tela e teclado
	// ficam "dentro" dele); ao fechar, devolve para quem tinha o foco (ex.: a
	// linha da lista que abriu o modal). Se um campo do modal já tem foco
	// (autoFocus), não mexe. preventScroll evita a página pular.
	useEffect(() => {
		if (!isOpen) return;
		const previous =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const dialog = dialogRef.current;
		if (dialog && !dialog.contains(document.activeElement)) {
			dialog.focus({ preventScroll: true });
		}
		return () => previous?.focus({ preventScroll: true });
	}, [isOpen]);

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
				ref={dialogRef}
				tabIndex={-1}
				style={{ outline: "none" }}
				className="modal-content"
				role="dialog"
				aria-modal="true"
				aria-label={title ?? "Modal"}
				onKeyDown={trapTab}
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
