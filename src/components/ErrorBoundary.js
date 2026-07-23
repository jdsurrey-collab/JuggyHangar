import { Component, createElement } from "react";
import { html } from "../html.js";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return html`
        <div style=${{ padding: "24px", color: "#ff6b6b", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          <h2>Something broke</h2>
          <div>${String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)}</div>
          <div style=${{ marginTop: "12px", opacity: 0.7 }}>${this.state.error?.stack}</div>
        </div>
      `;
    }
    return this.props.children;
  }
}
