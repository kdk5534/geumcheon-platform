package kr.go.geumcheon.dataplatform.admin;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import kr.go.geumcheon.dataplatform.api.ApiResponse;
import kr.go.geumcheon.dataplatform.config.LoginAttemptGuard;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/auth")
public class AdminSessionController {

    private final UserDetailsService userDetailsService;
    private final PasswordEncoder passwordEncoder;
    private final LoginAttemptGuard loginAttemptGuard;
    private final HttpSessionSecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    public AdminSessionController(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder,
            LoginAttemptGuard loginAttemptGuard
    ) {
        this.userDetailsService = userDetailsService;
        this.passwordEncoder = passwordEncoder;
        this.loginAttemptGuard = loginAttemptGuard;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AdminSessionUser>> login(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        String loginId = loginRequest.loginId();
        if (loginAttemptGuard.isBlocked(loginId)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(ApiResponse.fail("일시적으로 로그인이 제한되었습니다. 잠시 후 다시 시도해 주세요."));
        }
        try {
            UserDetails user = userDetailsService.loadUserByUsername(loginId);
            if (!passwordEncoder.matches(loginRequest.password(), user.getPassword())) {
                loginAttemptGuard.recordFailure(loginId);
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.fail("관리자 ID 또는 비밀번호를 확인해 주세요."));
            }
            loginAttemptGuard.reset(loginId);
            Authentication authentication = UsernamePasswordAuthenticationToken.authenticated(
                    user, null, user.getAuthorities());
            request.getSession(true);
            request.changeSessionId();
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            securityContextRepository.saveContext(context, request, response);
            return ResponseEntity.ok(ApiResponse.ok(toSessionUser(authentication)));
        } catch (AuthenticationException error) {
            loginAttemptGuard.recordFailure(loginId);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.fail("관리자 ID 또는 비밀번호를 확인해 주세요."));
        }
    }

    @GetMapping("/me")
    public ApiResponse<AdminSessionUser> me(Authentication authentication) {
        return ApiResponse.ok(toSessionUser(authentication));
    }

    @GetMapping("/csrf")
    public ApiResponse<CsrfSessionToken> csrf(CsrfToken csrfToken) {
        return ApiResponse.ok(new CsrfSessionToken(csrfToken.getHeaderName(), csrfToken.getToken()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response
    ) {
        new SecurityContextLogoutHandler().logout(request, response, authentication);
        return ApiResponse.ok(null);
    }

    private AdminSessionUser toSessionUser(Authentication authentication) {
        List<String> roles = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority().replaceFirst("^ROLE_", ""))
                .toList();
        return new AdminSessionUser(authentication.getName(), roles);
    }

    public record LoginRequest(
            @NotBlank String loginId,
            @NotBlank String password
    ) {
    }

    public record AdminSessionUser(String loginId, List<String> roles) {
    }

    public record CsrfSessionToken(String headerName, String token) {
    }
}
