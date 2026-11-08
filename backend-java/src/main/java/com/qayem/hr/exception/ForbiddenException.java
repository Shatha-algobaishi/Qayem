package com.qayem.hr.exception;

public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) { super(message); }
    public ForbiddenException() { super("Forbidden."); }
}
