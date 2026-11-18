import { Component, type ErrorInfo, type ReactNode } from 'react';

/* 编辑器错误边界（K8 稳定性兜底）。
 * 🔴 背景：WikiEditor（TipTap 富文本）在某些「Markdown 改动后切富文本」的场景会在渲染期抛错；
 *    全站没有任何 error boundary，一旦抛错整个 React 树被卸载 → 整页白屏。
 *    这里把崩溃「就地围栏」在编辑区，页头的模式切换 / 保存 / 历史版本等仍可用，用户可切到
 *    Markdown / 预览模式继续工作，不再整页白屏。真正的富文本渲染 bug 需 WikiEditor 侧修复。
 * resetKeys 变化（切文档 / 切模式）时自动复位重试。 */

interface Props {
  children: ReactNode;
  resetKeys?: unknown[];
  onReset?: () => void;
}
interface State {
  hasError: boolean;
}

export default class EditorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 仅记录，不上报数值/患者数据（此处只有编辑器渲染栈）。
    console.error('[EditorBoundary] 编辑器渲染异常，已就地围栏：', error, info?.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (!this.state.hasError) return;
    const a = prev.resetKeys ?? [];
    const b = this.props.resetKeys ?? [];
    if (a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]))) {
      this.setState({ hasError: false });
    }
  }

  private recover = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-0 flex-1 place-items-center px-6 py-10 text-center">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-xl">⚠️</div>
            <div className="text-sm font-medium text-ink-700">富文本编辑器渲染异常</div>
            <div className="mt-1 text-xs text-ink-400">
              该文档在「富文本」模式下渲染出错（未影响已保存内容）。可切换到 Markdown / 预览模式继续，或点下方按钮切到 Markdown 模式重试。
            </div>
            <button onClick={this.recover} className="btn-primary mt-4 px-3 py-1.5 text-xs">
              切到 Markdown 模式
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

