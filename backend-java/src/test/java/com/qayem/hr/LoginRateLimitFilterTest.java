package com.qayem.hr;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import com.qayem.hr.security.LoginRateLimitFilter;
import static org.junit.jupiter.api.Assertions.*;

class LoginRateLimitFilterTest {
    @Test void blocksRepeatedLoginAndLeavesOtherRoutesAvailable() throws Exception {
        var filter = new LoginRateLimitFilter();
        for (int i = 0; i < 20; i++) {
            var response = new MockHttpServletResponse();
            filter.doFilter(new MockHttpServletRequest("POST", "/api/v1/auth/login"), response, (req, res) -> {});
            assertEquals(200, response.getStatus());
        }
        var response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("POST", "/api/v1/auth/login"), response, (req, res) -> fail("Rate limit bypassed"));
        assertEquals(429, response.getStatus());
        assertEquals("60", response.getHeader("Retry-After"));
        response = new MockHttpServletResponse();
        filter.doFilter(new MockHttpServletRequest("GET", "/api/v1/auth/me"), response, (req, res) -> {});
        assertEquals(200, response.getStatus());
    }
}
