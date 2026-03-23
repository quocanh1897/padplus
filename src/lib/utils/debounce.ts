/**
 * Creates a debounced version of the given function.
 * The function will only execute after `ms` milliseconds have elapsed
 * since the last invocation. Call `.cancel()` to clear any pending execution.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	ms: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
	let timeoutId: ReturnType<typeof setTimeout>;
	const debounced = (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), ms);
	};
	debounced.cancel = () => clearTimeout(timeoutId);
	return debounced;
}
