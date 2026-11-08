package com.qayem.hr.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

/** Bounded per-instance protection; distributed deployments also need an edge limit. */
public class LoginRateLimitFilter extends OncePerRequestFilter {
    private record Window(long start, int count) {}
    private final ConcurrentHashMap<String, Window> attempts = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        if (!"POST".equals(request.getMethod()) || !"/api/v1/auth/login".equals(request.getRequestURI())) {
            chain.doFilter(request, response); return;
        }
        long now = System.currentTimeMillis();
        if (attempts.size() >= 10000) attempts.entrySet().removeIf(e -> now - e.getValue().start() >= 60000);
        String address = request.getRemoteAddr();
        if (!attempts.containsKey(address) && attempts.size() >= 10000) {
            reject(response); return;
        }
        Window window = attempts.compute(address, (key, previous) -> previous == null || now - previous.start() >= 60000
                ? new Window(now, 1) : new Window(previous.start(), previous.count() + 1));
        if (window.count() > 20) { reject(response); return; }
        chain.doFilter(request, response);
    }

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(429);
        response.setHeader("Retry-After", "60");
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"Too many sign-in attempts. Try again in one minute.\"}");
    }
}
