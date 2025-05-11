/// <summary>
/// CyclesController - Manages menstrual cycle records and associated symptoms
/// Full functionality version using separate DTOs and comprehensive error handling
/// </summary>

using Microsoft.AspNetCore.Mvc;

namespace PeriodTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CyclesController : ControllerBase
    {
        private readonly PeriodCycleRepository _periodCycleRepository;
        private readonly CycleSymptomRepository _cycleSymptomRepository;
        private readonly SymptomRepository _symptomRepository;
        private readonly UserRepository _userRepository;

        public CyclesController(
            PeriodCycleRepository periodCycleRepository,
            CycleSymptomRepository cycleSymptomRepository,
            SymptomRepository symptomRepository,
            UserRepository userRepository)
        {
            _periodCycleRepository = periodCycleRepository;
            _cycleSymptomRepository = cycleSymptomRepository;
            _symptomRepository = symptomRepository;
            _userRepository = userRepository;
        }

        // GET: api/cycles
        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public ActionResult<IEnumerable<CycleWithSymptomsDto>> GetUserCycles()
        {
            // Get authenticated user from context
            var authItem = HttpContext.Items["UserId"];
            if (authItem == null)
                return StatusCode(500, "Authentication context missing");

            int userId = Convert.ToInt32(authItem);

            // Get all cycles for this user
            var cycles = _periodCycleRepository.GetCyclesByUserId(userId);

            // Map to DTOs with symptoms
            var result = new List<CycleWithSymptomsDto>();

            foreach (var cycle in cycles)
            {
                // Fetch associated symptoms for this cycle
                var symptoms = _cycleSymptomRepository.GetSymptomsByCycleId(cycle.CycleId);

                // Create DTO with combined data
                var cycleDto = new CycleWithSymptomsDto
                {
                    CycleId = cycle.CycleId,
                    UserId = cycle.UserId,
                    StartDate = cycle.StartDate,
                    EndDate = cycle.EndDate,
                    Notes = cycle.Notes,
                    Symptoms = symptoms.Select(s => new CycleSymptomDto
                    {
                        SymptomId = s.SymptomId,
                        Name = s.Symptom?.Name ?? "Unknown",
                        Intensity = s.Intensity,
                        Date = s.Date
                    }).ToList()
                };

                result.Add(cycleDto);
            }

            return Ok(result);
        }

        // POST: api/cycles
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public ActionResult<CycleWithSymptomsDto> CreateCycle([FromBody] CreateCycleDto cycleData)
        {
            // Get authenticated user
            var authItem = HttpContext.Items["UserId"];
            if (authItem == null)
                return StatusCode(500, "Authentication context missing");

            int userId = Convert.ToInt32(authItem);

            // Verify userId matches authenticated user (security check)
            if (userId != cycleData.UserId)
                return Forbid("You can only create cycles for yourself");

            // Validate date ordering
            if (cycleData.EndDate < cycleData.StartDate)
                return BadRequest("End date must be after start date");

            // Create cycle entity
            var cycle = new PeriodCycle
            {
                UserId = cycleData.UserId,
                StartDate = cycleData.StartDate,
                EndDate = cycleData.EndDate,
                Notes = cycleData.Notes,
                CreatedAt = DateTime.UtcNow
            };

            // Insert cycle - repository returns true on success and populates CycleId
            if (!_periodCycleRepository.InsertCycle(cycle))
                return BadRequest("Failed to create cycle");

            // Add symptoms if any
            if (cycleData.Symptoms != null && cycleData.Symptoms.Count > 0)
            {
                foreach (var symptomDto in cycleData.Symptoms)
                {
                    // Ensure symptom date is within cycle range
                    var symptomDate = symptomDto.Date;
                    if (symptomDate < cycleData.StartDate) symptomDate = cycleData.StartDate;
                    if (symptomDate > cycleData.EndDate) symptomDate = cycleData.EndDate;

                    var cycleSymptom = new CycleSymptom
                    {
                        CycleId = cycle.CycleId,  // This is populated from InsertCycle
                        SymptomId = symptomDto.SymptomId,
                        Intensity = symptomDto.Intensity,
                        Date = symptomDate,
                        CreatedAt = DateTime.UtcNow
                    };

                    // Add debug logging
                    Console.WriteLine($"Inserting symptom: CycleId={cycleSymptom.CycleId}, SymptomId={cycleSymptom.SymptomId}, Intensity={cycleSymptom.Intensity}, Date={cycleSymptom.Date}");

                    if (!_cycleSymptomRepository.InsertCycleSymptom(cycleSymptom))
                    {
                        // Log error but don't fail the entire operation
                        Console.WriteLine($"Failed to insert symptom: {symptomDto.SymptomId}");
                    }
                }
            }

            // Fetch symptoms to include in response
            var savedSymptoms = _cycleSymptomRepository.GetSymptomsByCycleId(cycle.CycleId);

            // Return the created cycle with its ID and symptoms
            var result = new CycleWithSymptomsDto
            {
                CycleId = cycle.CycleId,
                UserId = cycle.UserId,
                StartDate = cycle.StartDate,
                EndDate = cycle.EndDate,
                Notes = cycle.Notes,
                Symptoms = savedSymptoms.Select(s => new CycleSymptomDto
                {
                    SymptomId = s.SymptomId,
                    Name = s.Symptom?.Name ?? "Unknown",
                    Intensity = s.Intensity,
                    Date = s.Date
                }).ToList()
            };

            return CreatedAtAction(nameof(GetUserCycles), result);
        }

        // PUT: api/cycles/{id}
        [HttpPut("{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public ActionResult<CycleWithSymptomsDto> UpdateCycle(int id, [FromBody] UpdateCycleDTO cycleData)
        {
            // Get authenticated user
            var authItem = HttpContext.Items["UserId"];
            if (authItem == null)
                return StatusCode(500, "Authentication context missing");

            int userId = Convert.ToInt32(authItem);

            // Verify user can update this cycle (security check)
            if (userId != cycleData.UserId)
                return Forbid("You can only update your own cycles");

            // Validate that ID matches
            if (id != cycleData.CycleId)
                return BadRequest("Cycle ID in URL must match the ID in the request body");

            // Ensure cycle exists
            var existing = _periodCycleRepository.GetById(id);
            if (existing == null)
                return NotFound($"Cycle with ID {id} not found");

            // Validate date ordering
            if (cycleData.EndDate < cycleData.StartDate)
                return BadRequest("End date must be after start date");

            // Update cycle entity
            var cycle = new PeriodCycle
            {
                CycleId = cycleData.CycleId,
                UserId = cycleData.UserId,
                StartDate = cycleData.StartDate,
                EndDate = cycleData.EndDate,
                Notes = cycleData.Notes
            };

            // Update in database
            if (!_periodCycleRepository.UpdateCycle(cycle))
                return BadRequest("Failed to update cycle");

            // Handle symptoms - first delete all existing
            if (!_cycleSymptomRepository.DeleteCycleSymptomsByCycleId(id))
            {
                Console.WriteLine($"Warning: Failed to delete existing symptoms for cycle {id}");
            }

            // Then add new symptoms
            if (cycleData.Symptoms != null && cycleData.Symptoms.Count > 0)
            {
                foreach (var symptomDto in cycleData.Symptoms)
                {
                    // Ensure symptom date is within cycle range
                    var symptomDate = symptomDto.Date;
                    if (symptomDate < cycleData.StartDate) symptomDate = cycleData.StartDate;
                    if (symptomDate > cycleData.EndDate) symptomDate = cycleData.EndDate;

                    var cycleSymptom = new CycleSymptom
                    {
                        CycleId = id,
                        SymptomId = symptomDto.SymptomId,
                        Intensity = symptomDto.Intensity,
                        Date = symptomDate,
                        CreatedAt = DateTime.UtcNow
                    };

                    // Add debug logging
                    Console.WriteLine($"Updating symptom: CycleId={cycleSymptom.CycleId}, SymptomId={cycleSymptom.SymptomId}, Intensity={cycleSymptom.Intensity}, Date={cycleSymptom.Date}");

                    if (!_cycleSymptomRepository.InsertCycleSymptom(cycleSymptom))
                    {
                        // Log error but don't fail the entire operation
                        Console.WriteLine($"Failed to insert symptom: {symptomDto.SymptomId}");
                    }
                }
            }

            // Fetch symptoms to include in response
            var savedSymptoms = _cycleSymptomRepository.GetSymptomsByCycleId(id);

            // Return the updated cycle as CycleWithSymptomsDto
            var result = new CycleWithSymptomsDto
            {
                CycleId = cycleData.CycleId,
                UserId = cycleData.UserId,
                StartDate = cycleData.StartDate,
                EndDate = cycleData.EndDate,
                Notes = cycleData.Notes,
                Symptoms = savedSymptoms.Select(s => new CycleSymptomDto
                {
                    SymptomId = s.SymptomId,
                    Name = s.Symptom?.Name ?? "Unknown",
                    Intensity = s.Intensity,
                    Date = s.Date
                }).ToList()
            };

            return Ok(result);
        }

        // DELETE: api/cycles/{id}
        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public ActionResult DeleteCycle(int id)
        {
            // Get authenticated user
            var authItem = HttpContext.Items["UserId"];
            if (authItem == null)
                return StatusCode(500, "Authentication context missing");

            int userId = Convert.ToInt32(authItem);

            // Check if cycle exists
            var existing = _periodCycleRepository.GetById(id);
            if (existing == null)
                return NotFound($"Cycle with ID {id} not found");

            // Verify user can delete this cycle (security check)
            if (existing.UserId != userId)
                return StatusCode(StatusCodes.Status403Forbidden, "Cannot delete others' cycles");

            // Delete associated symptoms first to maintain referential integrity
            _cycleSymptomRepository.DeleteCycleSymptomsByCycleId(id);

            // Then delete the cycle
            if (!_periodCycleRepository.DeleteCycle(id, userId))
                return BadRequest("Failed to delete cycle");

            return NoContent();
        }
    }

    // DTO for returning cycle data with symptoms
    public class CycleWithSymptomsDto
    {
        public int CycleId { get; set; }
        public int UserId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Notes { get; set; }
        public List<CycleSymptomDto> Symptoms { get; set; } = new List<CycleSymptomDto>();
    }

    // DTO for updating a cycle
    public class UpdateCycleDTO
    {
        public int CycleId { get; set; }
        public int UserId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Notes { get; set; }
        public List<CycleSymptomDto> Symptoms { get; set; } = new List<CycleSymptomDto>();
    }

    // DTO for creating a new cycle
    public class CreateCycleDto
    {
        public int UserId { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Notes { get; set; }
        public List<CycleSymptomDto> Symptoms { get; set; } = new List<CycleSymptomDto>();
    }

    // DTO for cycle symptoms
    public class CycleSymptomDto
    {
        public int SymptomId { get; set; }
        public string Name { get; set; }
        public int Intensity { get; set; }
        public DateTime Date { get; set; }
    }
}