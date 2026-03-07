/**
 * Creates a debounced version of the given function.
 * The function will only execute after `ms` milliseconds have elapsed
 * since the last invocation.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	fn: T,
	ms: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), ms);
	};
}
