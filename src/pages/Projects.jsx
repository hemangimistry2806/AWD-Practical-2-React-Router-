import { useEffect, useState } from "react";


function Projects() {


  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



  const fetchRepos = async () => {

    try {

      setLoading(true);
      setError(null);


      const response = await fetch(
        "https://api.github.com/users/hemangimistry2806/repos?sort=updated&per_page=6"
      );


      if (!response.ok) {

        throw new Error("Unable to fetch GitHub projects");

      }


      const data = await response.json();

      setRepos(data);


    } 
    
    catch(err) {

      setError(err.message);

    }


    finally {

      setLoading(false);

    }

  };




  useEffect(() => {

    fetchRepos();

  }, []);





  return (

    <section className="page-card">


      <h2>
        My GitHub Projects 🚀
      </h2>





      {
        loading && (

          <p>
            Loading projects...
          </p>

        )
      }






      {
        error && (

          <div>

            <p>
              {error}
            </p>


            <button onClick={fetchRepos}>
              Retry
            </button>


          </div>

        )
      }







      {
        !loading && !error && (

          <div className="project-grid">


            {
              repos.map((repo)=>(


                <div
                  className="project-card"
                  key={repo.id}
                >





                  <a

                    href={repo.html_url}

                    target="_blank"

                    rel="noreferrer"

                    className="project-title"

                  >

                    <h3>

                      {
                        repo.name
                        .replaceAll("-", " ")
                        .replaceAll("_", " ")
                      }

                    </h3>


                  </a>







                  <p>

                    {
                      repo.description ||
                      "A GitHub project developed using modern technologies."

                    }

                  </p>







                  <div className="project-info">


                    <span>
                      ⭐ {repo.stargazers_count}
                    </span>





                    {
                      repo.language && (

                        <span className="language">

                          {repo.language}

                        </span>

                      )

                    }



                  </div>





                </div>


              ))
            }



          </div>


        )
      }





    </section>

  );

}


export default Projects;